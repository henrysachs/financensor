package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type contextKey string

const UserIDKey contextKey = "userID"

var jwtSecret = []byte(getEnvOrDefault("JWT_SECRET", "dev-secret-change-in-production"))

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  getEnvOrDefault("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/auth/google/callback"),
		Scopes:       []string{"openid", "profile", "email"},
		Endpoint:     google.Endpoint,
	}
}

type GoogleUserInfo struct {
	Sub     string `json:"sub"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture"`
}

type Claims struct {
	UserID string `json:"uid"`
	jwt.RegisteredClaims
}

func GenerateToken(userID string) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

// writeProblem writes an RFC 9457 problem+json error response
func writeError(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{
		"type":   "about:blank",
		"title":  http.StatusText(status),
		"status": status,
		"detail": detail,
	})
}

func JWTMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
			writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
			return
		}

		tokenStr := authHeader[7:]
		claims, err := ParseToken(tokenStr)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetUserID(ctx context.Context) string {
	uid, _ := ctx.Value(UserIDKey).(string)
	return uid
}

// generateState creates a cryptographically random state string
func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func HandleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	cfg := getOAuthConfig()
	state := generateState()

	// Store state in a short-lived cookie for CSRF validation
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/api/v1/auth",
		MaxAge:   300, // 5 minutes
		HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode,
	})

	url := cfg.AuthCodeURL(state, oauth2.AccessTypeOffline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func HandleGoogleCallback(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg := getOAuthConfig()

		// Validate CSRF state
		stateCookie, err := r.Cookie("oauth_state")
		if err != nil || stateCookie.Value == "" {
			slog.Warn("oauth callback: missing state cookie")
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}
		if r.URL.Query().Get("state") != stateCookie.Value {
			slog.Warn("oauth callback: state mismatch")
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}

		// Clear state cookie
		http.SetCookie(w, &http.Cookie{
			Name:   "oauth_state",
			Value:  "",
			Path:   "/api/v1/auth",
			MaxAge: -1,
		})

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "missing code", http.StatusBadRequest)
			return
		}

		token, err := cfg.Exchange(r.Context(), code)
		if err != nil {
			slog.Error("oauth exchange failed", "error", err)
			http.Error(w, "oauth exchange failed", http.StatusInternalServerError)
			return
		}

		client := cfg.Client(r.Context(), token)
		resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
		if err != nil {
			slog.Error("failed to get user info", "error", err)
			http.Error(w, "failed to get user info", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		var info GoogleUserInfo
		if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
			slog.Error("failed to decode user info", "error", err)
			http.Error(w, "failed to decode user info", http.StatusInternalServerError)
			return
		}

		// Upsert user
		var userID string
		err = db.Get(&userID, "SELECT id FROM users WHERE google_id = ?", info.Sub)
		if err != nil {
			// Create new user
			userID = uuid.New().String()
			_, err = db.Exec(
				"INSERT INTO users (id, name, email, google_id, avatar_url, is_ghost) VALUES (?, ?, ?, ?, ?, 0)",
				userID, info.Name, info.Email, info.Sub, info.Picture,
			)
			if err != nil {
				slog.Error("failed to create user", "error", err, "email", info.Email, "google_id", info.Sub)
				http.Error(w, "failed to create user", http.StatusInternalServerError)
				return
			}
		}

		jwtToken, err := GenerateToken(userID)
		if err != nil {
			slog.Error("failed to generate token", "error", err, "user_id", userID)
			http.Error(w, "failed to generate token", http.StatusInternalServerError)
			return
		}

		frontendURL := getEnvOrDefault("FRONTEND_URL", "http://localhost:5173")
		http.Redirect(w, r, frontendURL+"/auth/callback?token="+jwtToken, http.StatusTemporaryRedirect)
	}
}
