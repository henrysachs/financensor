package api

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/henrysachs/financensor/backend/internal/auth"
	mw "github.com/henrysachs/financensor/backend/internal/middleware"
	"github.com/henrysachs/financensor/backend/internal/repository"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

const uploadsDir = "uploads"

func NewRouter(repo repository.Repository, storage repository.ReceiptStorage) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return otelhttp.NewHandler(next, "financensor",
			otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
				return r.Method + " " + r.URL.Path
			}),
		)
	})
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "https://financensor.stammkneipe.dev"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "traceparent", "tracestate"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(mw.PrometheusMetrics)
	r.Use(mw.SlogRequestLogger)

	r.Get("/metrics", promhttp.Handler().ServeHTTP)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	fileServer := http.FileServer(http.Dir(uploadsDir))
	r.Group(func(r chi.Router) {
		r.Use(auth.AuthMiddleware(repo))
		r.Handle("/uploads/*", http.StripPrefix("/uploads/", fileServer))
	})

	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Get("/google/login", HandleGoogleLogin)
		r.Get("/google/callback", HandleGoogleCallback(repo.Users()))
	})

	apiConfig := huma.DefaultConfig("Financensor API", "1.0.0")
	apiConfig.Servers = []*huma.Server{
		{URL: "https://api.financensor.stammkneipe.dev"},
	}

	r.Route("/api/v1", func(sub chi.Router) {
		// Skip auth for Huma's built-in OpenAPI/docs/schemas endpoints
		sub.Use(auth.AuthMiddlewareSkipping(repo, auth.PublicPaths{
			Exact: []string{
				"/api/v1/openapi.json",
				"/api/v1/openapi.yaml",
				"/api/v1/openapi-3.0.json",
				"/api/v1/openapi-3.0.yaml",
				"/api/v1/docs",
			},
			Prefixes: []string{
				"/api/v1/schemas/",
			},
		}))

		humaAPI := humachi.New(sub, apiConfig)

		memberMW := requireMember(humaAPI, repo)
		adminMW := requireAdmin(humaAPI, repo)

		// Routes that don't require group membership (user-level)
		registerUserRoutes(humaAPI, repo)

		// Group-scoped routes with membership/admin middleware
		registerGroupRoutes(humaAPI, repo, memberMW, adminMW)
		registerPurchaseRoutes(humaAPI, repo, memberMW)
		registerCategoryRoutes(humaAPI, repo, memberMW)
		registerSettlementRoutes(humaAPI, repo, memberMW)
		registerReceiptRoutes(humaAPI, repo, storage, memberMW)
		registerInviteRoutes(humaAPI, repo, memberMW, adminMW)
		registerTripRoutes(humaAPI, repo, memberMW, adminMW)
		registerAPIKeyRoutes(humaAPI, repo, adminMW)
	})

	return r
}
