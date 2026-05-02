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

func createGroup(db *sqlx.DB) http.HandlerFunc {
	type request struct {
		Name string `json:"name"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Name == "" {
			writeError(w, http.StatusBadRequest, "name is required")
			return
		}

		groupID := uuid.New().String()
		tx, err := db.Beginx()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to begin transaction")
			return
		}
		defer tx.Rollback()

		_, err = tx.Exec(
			"INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)",
			groupID, req.Name, userID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create group")
			return
		}

		_, err = tx.Exec(
			"INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
			groupID, userID, model.RoleAdmin,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to add admin member")
			return
		}

		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to commit")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]string{"id": groupID})
	}
}

func listGroups(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := auth.GetUserID(r.Context())

		var groups []model.Group
		err := db.Select(&groups, `
			SELECT g.id, g.name, g.created_by, g.created_at
			FROM groups g
			JOIN group_members gm ON g.id = gm.group_id
			WHERE gm.user_id = ?
			ORDER BY g.created_at DESC
		`, userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list groups")
			return
		}

		if groups == nil {
			groups = []model.Group{}
		}

		writeJSON(w, http.StatusOK, groups)
	}
}

func getGroup(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member of this group")
			return
		}

		var group model.Group
		err := db.Get(&group, "SELECT id, name, created_by, created_at FROM groups WHERE id = ?", groupID)
		if err != nil {
			writeError(w, http.StatusNotFound, "group not found")
			return
		}

		writeJSON(w, http.StatusOK, group)
	}
}

func updateGroup(db *sqlx.DB) http.HandlerFunc {
	type request struct {
		Name string `json:"name"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isAdmin(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		_, err := db.Exec("UPDATE groups SET name = ? WHERE id = ?", req.Name, groupID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update group")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

func deleteGroup(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isAdmin(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}

		_, err := db.Exec("DELETE FROM groups WHERE id = ?", groupID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to delete group")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

func addMember(db *sqlx.DB) http.HandlerFunc {
	type request struct {
		UserID string `json:"userId"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isAdmin(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}

		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		_, err := db.Exec(
			"INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
			groupID, req.UserID, model.RoleMember,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to add member")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]string{"status": "added"})
	}
}

func removeMember(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		targetUserID := chi.URLParam(r, "userID")
		userID := auth.GetUserID(r.Context())

		if !isAdmin(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "admin only")
			return
		}

		if targetUserID == userID {
			writeError(w, http.StatusBadRequest, "cannot remove yourself")
			return
		}

		_, err := db.Exec(
			"DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
			groupID, targetUserID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to remove member")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
	}
}

func isMember(db *sqlx.DB, groupID, userID string) bool {
	var count int
	err := db.Get(&count, "SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?", groupID, userID)
	return err == nil && count > 0
}

func isAdmin(db *sqlx.DB, groupID, userID string) bool {
	var role string
	err := db.Get(&role, "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?", groupID, userID)
	return err == nil && role == string(model.RoleAdmin)
}

type memberResponse struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Email     *string `json:"email,omitempty"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
	IsGhost   bool    `json:"isGhost"`
	Role      string  `json:"role"`
}

func listMembers(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		var members []memberResponse
		err := db.Select(&members, `
			SELECT u.id, u.name, u.email, u.avatar_url, u.is_ghost, gm.role
			FROM users u
			JOIN group_members gm ON u.id = gm.user_id
			WHERE gm.group_id = ?
			ORDER BY gm.role ASC, u.name ASC
		`, groupID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list members")
			return
		}

		if members == nil {
			members = []memberResponse{}
		}

		writeJSON(w, http.StatusOK, members)
	}
}
