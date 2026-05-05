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
	"github.com/jmoiron/sqlx"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func NewRouter(db *sqlx.DB) http.Handler {
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

	// Prometheus metrics endpoint (internal only, not exposed via Traefik)
	r.Get("/metrics", promhttp.Handler().ServeHTTP)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Serve uploaded receipts (protected)
	fileServer := http.FileServer(http.Dir(uploadsDir))
	r.Group(func(r chi.Router) {
		r.Use(auth.AuthMiddleware(db))
		r.Handle("/uploads/*", http.StripPrefix("/uploads/", fileServer))
	})

	// Plain chi routes for OAuth (redirects, not JSON)
	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Get("/google/login", auth.HandleGoogleLogin)
		r.Get("/google/callback", auth.HandleGoogleCallback(db))
	})

	// Huma API config
	apiConfig := huma.DefaultConfig("Financensor API", "1.0.0")
	apiConfig.Servers = []*huma.Server{
		{URL: "https://api.financensor.stammkneipe.dev"},
	}

	// Public Huma routes (OpenAPI docs)
	r.Route("/api/v1", func(sub chi.Router) {
		// Public sub-group for docs/schemas (no auth)
		sub.Group(func(pub chi.Router) {
			humachi.New(pub, apiConfig)
			// Huma auto-registers /openapi.json, /docs, /schemas/* here
		})

		// Protected sub-group for all API endpoints
		sub.Group(func(prot chi.Router) {
			prot.Use(auth.AuthMiddleware(db))

			api := humachi.New(prot, apiConfig)

			registerGroupRoutes(api, db)
			registerPurchaseRoutes(api, db)
			registerCategoryRoutes(api, db)
			registerSettlementRoutes(api, db)
			registerUserRoutes(api, db)
			registerReceiptRoutes(api, db)
			registerInviteRoutes(api, db)
			registerTripRoutes(api, db)
			registerAPIKeyRoutes(api, db)
		})
	})

	return r
}
