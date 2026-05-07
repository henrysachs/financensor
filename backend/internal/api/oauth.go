package api

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"

	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/metrics"
	"github.com/henrysachs/financensor/backend/internal/repository"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type googleUserInfo struct {
	Sub     string `json:"sub"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture"`
}

func getOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  envOrDefault("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/auth/google/callback"),
		Scopes:       []string{"openid", "profile", "email"},
		Endpoint:     google.Endpoint,
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// HandleGoogleLogin initiates the Google OAuth flow.
func HandleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	cfg := getOAuthConfig()
	state := generateState()

	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/api/v1/auth",
		MaxAge:   300,
		HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode,
	})

	url := cfg.AuthCodeURL(state, oauth2.AccessTypeOffline)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// HandleGoogleCallback handles the OAuth callback, upserts the user, and redirects with a JWT.
func HandleGoogleCallback(users repository.UserRepository) http.HandlerFunc {
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

		var info googleUserInfo
		if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
			slog.Error("failed to decode user info", "error", err)
			http.Error(w, "failed to decode user info", http.StatusInternalServerError)
			return
		}

		userID, created, err := users.UpsertByGoogleID(r.Context(), repository.UpsertUserParams{
			Name:      info.Name,
			Email:     info.Email,
			GoogleID:  info.Sub,
			AvatarURL: info.Picture,
		})
		if err != nil {
			slog.Error("failed to upsert user", "error", err, "email", info.Email, "google_id", info.Sub)
			http.Error(w, "failed to create user", http.StatusInternalServerError)
			return
		}
		if created {
			metrics.UsersCreatedTotal.WithLabelValues("oauth").Inc()
		}

		jwtToken, err := auth.GenerateToken(userID)
		if err != nil {
			slog.Error("failed to generate token", "error", err, "user_id", userID)
			http.Error(w, "failed to generate token", http.StatusInternalServerError)
			return
		}

		frontendURL := auth.GetFrontendURL()
		http.Redirect(w, r, frontendURL+"/auth/callback?token="+jwtToken, http.StatusTemporaryRedirect)
	}
}
