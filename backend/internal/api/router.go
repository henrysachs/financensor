package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/jmoiron/sqlx"
)

func NewRouter(db *sqlx.DB) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "https://financensor.stammkneipe.dev"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Serve uploaded receipts
	fileServer := http.FileServer(http.Dir(uploadsDir))
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", fileServer))

	r.Route("/api/v1", func(r chi.Router) {
		// Public routes
		r.Route("/auth", func(r chi.Router) {
			r.Get("/google/login", auth.HandleGoogleLogin)
			r.Get("/google/callback", auth.HandleGoogleCallback(db))
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(auth.JWTMiddleware)

			r.Route("/groups", func(r chi.Router) {
				r.Post("/", createGroup(db))
				r.Get("/", listGroups(db))

				r.Route("/{groupID}", func(r chi.Router) {
					r.Get("/", getGroup(db))
					r.Put("/", updateGroup(db))
					r.Delete("/", deleteGroup(db))

					r.Route("/members", func(r chi.Router) {
						r.Get("/", listMembers(db))
						r.Post("/", addMember(db))
						r.Delete("/{userID}", removeMember(db))
					})

					r.Route("/purchases", func(r chi.Router) {
						r.Post("/", createPurchase(db))
						r.Post("/bulk", createPurchasesBulk(db))
						r.Get("/", listPurchases(db))
						r.Put("/{purchaseID}", updatePurchase(db))
						r.Delete("/{purchaseID}", deletePurchase(db))
						r.Post("/{purchaseID}/receipt", uploadReceipt(db))
					})

					r.Route("/categories", func(r chi.Router) {
						r.Post("/", createCategory(db))
						r.Get("/", listCategories(db))
					})

					r.Get("/settlements", calculateSettlements(db))
					r.Post("/settlements/{settlementID}/paid", markSettlementPaid(db))
				})
			})

			r.Route("/users", func(r chi.Router) {
				r.Get("/me", getMe(db))
				r.Post("/ghost", createGhostUser(db))
				r.Post("/{userID}/claim", claimGhostUser(db))
			})
		})
	})

	return r
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
