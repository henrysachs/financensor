package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/jmoiron/sqlx"
)

func getMe(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())

		var user model.User
		err := db.Get(&user, "SELECT id, name, email, avatar_url, is_ghost, created_at FROM users WHERE id = ?", userID)
		if err != nil {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}

		writeJSON(w, http.StatusOK, user)
	}
}

func createGhostUser(db *sqlx.DB) http.HandlerFunc {
	type request struct {
		Name string `json:"name"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Name == "" {
			writeError(w, http.StatusBadRequest, "name is required")
			return
		}

		id := uuid.New().String()
		_, err := db.Exec(
			"INSERT INTO users (id, name, is_ghost) VALUES (?, ?, 1)",
			id, req.Name,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create ghost user")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
	}
}

func claimGhostUser(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		targetUserID := chi.URLParam(r, "userID")
		claimerID := auth.GetUserID(r.Context())

		// Verify target is a ghost
		var target model.User
		err := db.Get(&target, "SELECT id, is_ghost FROM users WHERE id = ?", targetUserID)
		if err != nil {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}

		if !target.IsGhost {
			writeError(w, http.StatusBadRequest, "user is not a ghost account")
			return
		}

		// Get claimer info
		var claimer model.User
		err = db.Get(&claimer, "SELECT id, name, email, google_id, avatar_url FROM users WHERE id = ?", claimerID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get claimer info")
			return
		}

		tx, err := db.Beginx()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to begin transaction")
			return
		}
		defer tx.Rollback()

		// Transfer all references from ghost to claimer
		tx.Exec("UPDATE group_members SET user_id = ? WHERE user_id = ?", claimerID, targetUserID)
		tx.Exec("UPDATE purchases SET paid_by_user_id = ? WHERE paid_by_user_id = ?", claimerID, targetUserID)
		tx.Exec("UPDATE purchases SET created_by = ? WHERE created_by = ?", claimerID, targetUserID)
		tx.Exec("UPDATE assignments SET user_id = ? WHERE user_id = ?", claimerID, targetUserID)
		tx.Exec("UPDATE settlements SET from_user_id = ? WHERE from_user_id = ?", claimerID, targetUserID)
		tx.Exec("UPDATE settlements SET to_user_id = ? WHERE to_user_id = ?", claimerID, targetUserID)

		// Delete ghost
		tx.Exec("DELETE FROM users WHERE id = ?", targetUserID)

		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to claim ghost user")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "claimed"})
	}
}
