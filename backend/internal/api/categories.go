package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/jmoiron/sqlx"
)

func createCategory(db *sqlx.DB) http.HandlerFunc {
	type request struct {
		Name string `json:"name"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		var req request
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Name == "" {
			writeError(w, http.StatusBadRequest, "name is required")
			return
		}

		id := uuid.New().String()
		_, err := db.Exec("INSERT INTO categories (id, group_id, name) VALUES (?, ?, ?)", id, groupID, req.Name)
		if err != nil {
			writeError(w, http.StatusConflict, "category already exists")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]string{"id": id})
	}
}

func listCategories(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		var categories []model.Category
		err := db.Select(&categories, "SELECT id, group_id, name FROM categories WHERE group_id = ?", groupID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list categories")
			return
		}

		if categories == nil {
			categories = []model.Category{}
		}

		writeJSON(w, http.StatusOK, categories)
	}
}
