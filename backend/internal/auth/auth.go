package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

type contextKey string

const (
	UserIDKey        contextKey = "userID"
	APIKeyIDKey      contextKey = "apiKeyID"
	APIKeyGroupIDKey contextKey = "apiKeyGroupID"
	IsAPIKeyKey      contextKey = "isAPIKey"
	APIKeyPrefix                = "fin-token_"
)

var jwtSecret = []byte(getEnvOrDefault("JWT_SECRET", "dev-secret-change-in-production"))

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// GetFrontendURL returns the configured frontend URL.
func GetFrontendURL() string {
	return getEnvOrDefault("FRONTEND_URL", "http://localhost:5173")
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

func GenerateAPIKey() (string, string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token := APIKeyPrefix + base64.RawURLEncoding.EncodeToString(b)
	return token, HashAPIKey(token), nil
}

func HashAPIKey(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// AuthMiddleware authenticates requests via JWT or API key using the repository.
func AuthMiddleware(repo repository.Repository) func(http.Handler) http.Handler {
	return AuthMiddlewareSkipping(repo, PublicPaths{})
}

// PublicPaths configures which paths skip authentication.
type PublicPaths struct {
	// Exact paths that skip auth (e.g., "/api/v1/openapi.json").
	Exact []string
	// Prefixes where any path starting with the prefix skips auth (e.g., "/api/v1/schemas/").
	Prefixes []string
}

// AuthMiddlewareSkipping authenticates requests but skips auth for configured public paths.
func AuthMiddlewareSkipping(repo repository.Repository, public PublicPaths) func(http.Handler) http.Handler {
	exact := make(map[string]bool, len(public.Exact))
	for _, p := range public.Exact {
		exact[p] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if exact[r.URL.Path] || matchesPrefix(r.URL.Path, public.Prefixes) {
				next.ServeHTTP(w, r)
				return
			}

			authHeader := r.Header.Get("Authorization")
			if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
				writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
				return
			}

			tokenStr := authHeader[7:]
			if strings.HasPrefix(tokenStr, APIKeyPrefix) {
				key, err := repo.APIKeys().GetByTokenHash(r.Context(), HashAPIKey(tokenStr))
				if err != nil || key.RevokedAt != nil {
					writeError(w, http.StatusUnauthorized, "invalid api key")
					return
				}

				isMember, _ := repo.Groups().IsMember(r.Context(), key.GroupID, key.ActingAsUserID)
				if !isMember {
					writeError(w, http.StatusUnauthorized, "api key user is no longer a group member")
					return
				}

				if !apiKeyAllowedRequest(r, key.GroupID) {
					writeError(w, http.StatusForbidden, "api key not allowed for this endpoint")
					return
				}

				repo.APIKeys().TouchLastUsed(r.Context(), key.ID) //nolint:errcheck

				ctx := context.WithValue(r.Context(), UserIDKey, key.ActingAsUserID)
				ctx = context.WithValue(ctx, APIKeyIDKey, key.ID)
				ctx = context.WithValue(ctx, APIKeyGroupIDKey, key.GroupID)
				ctx = context.WithValue(ctx, IsAPIKeyKey, true)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			claims, err := ParseToken(tokenStr)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) string {
	uid, _ := ctx.Value(UserIDKey).(string)
	return uid
}

func IsAPIKey(ctx context.Context) bool {
	isAPIKey, _ := ctx.Value(IsAPIKeyKey).(bool)
	return isAPIKey
}

func GetAPIKeyGroupID(ctx context.Context) string {
	groupID, _ := ctx.Value(APIKeyGroupIDKey).(string)
	return groupID
}

// writeError writes an RFC 9457 problem+json error response.
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

func apiKeyAllowedRequest(r *http.Request, groupID string) bool {
	if r.Method == http.MethodGet && r.URL.Path == "/api/v1/users/me" {
		return true
	}

	groupPrefix := "/api/v1/groups/" + groupID
	if r.URL.Path != groupPrefix && !strings.HasPrefix(r.URL.Path, groupPrefix+"/") {
		return false
	}

	remainder := strings.TrimPrefix(r.URL.Path, groupPrefix)
	switch {
	case remainder == "" || remainder == "/":
		return r.Method == http.MethodGet
	case remainder == "/members":
		return r.Method == http.MethodGet
	case remainder == "/purchases":
		return r.Method == http.MethodGet || r.Method == http.MethodPost
	case remainder == "/purchases/bulk":
		return r.Method == http.MethodPost
	case strings.HasSuffix(remainder, "/receipt") && strings.HasPrefix(remainder, "/purchases/"):
		return r.Method == http.MethodPost
	case strings.HasPrefix(remainder, "/purchases/"):
		return r.Method == http.MethodPut || r.Method == http.MethodDelete
	case remainder == "/categories":
		return r.Method == http.MethodGet || r.Method == http.MethodPost
	case remainder == "/trips":
		return r.Method == http.MethodGet || r.Method == http.MethodPost
	case strings.HasPrefix(remainder, "/trips/"):
		return r.Method == http.MethodGet || r.Method == http.MethodPut
	case remainder == "/settlements":
		return r.Method == http.MethodGet
	default:
		return false
	}
}

// matchesPrefix checks if the path starts with any of the given prefixes.
func matchesPrefix(path string, prefixes []string) bool {
	for _, p := range prefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}
