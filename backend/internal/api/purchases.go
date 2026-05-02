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

type purchaseRequest struct {
	Description  string   `json:"description"`
	AmountCents  int64    `json:"amountCents"`
	PaidByUserID string   `json:"paidByUserId"`
	CategoryID   *string  `json:"categoryId,omitempty"`
	AssignedTo   []string `json:"assignedTo"`
}

func createPurchase(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		var req purchaseRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Description == "" || req.AmountCents <= 0 || req.PaidByUserID == "" {
			writeError(w, http.StatusBadRequest, "description, amountCents, and paidByUserId are required")
			return
		}

		purchaseID, err := insertPurchase(db, groupID, userID, req)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create purchase")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]string{"id": purchaseID})
	}
}

func createPurchasesBulk(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		var reqs []purchaseRequest
		if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		ids := make([]string, 0, len(reqs))
		for _, req := range reqs {
			if req.Description == "" || req.AmountCents <= 0 || req.PaidByUserID == "" {
				continue
			}
			id, err := insertPurchase(db, groupID, userID, req)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to create purchase")
				return
			}
			ids = append(ids, id)
		}

		writeJSON(w, http.StatusCreated, map[string]any{"ids": ids, "count": len(ids)})
	}
}

func listPurchases(db *sqlx.DB) http.HandlerFunc {
	type purchaseWithAssignments struct {
		model.Purchase
		Assignments []model.Assignment `json:"assignments"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		var purchases []model.Purchase
		err := db.Select(&purchases, `
			SELECT id, group_id, description, amount_cents, paid_by_user_id, category_id, receipt_url, created_by, created_at
			FROM purchases WHERE group_id = ? ORDER BY created_at DESC
		`, groupID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list purchases")
			return
		}

		result := make([]purchaseWithAssignments, 0, len(purchases))
		for _, p := range purchases {
			var assignments []model.Assignment
			db.Select(&assignments, "SELECT id, purchase_id, user_id, custom_share_cents FROM assignments WHERE purchase_id = ?", p.ID)
			if assignments == nil {
				assignments = []model.Assignment{}
			}
			result = append(result, purchaseWithAssignments{Purchase: p, Assignments: assignments})
		}

		writeJSON(w, http.StatusOK, result)
	}
}

func updatePurchase(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		purchaseID := chi.URLParam(r, "purchaseID")
		userID := auth.GetUserID(r.Context())

		if !canEditPurchase(db, groupID, purchaseID, userID) {
			writeError(w, http.StatusForbidden, "cannot edit this purchase")
			return
		}

		var req purchaseRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		tx, err := db.Beginx()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to begin transaction")
			return
		}
		defer tx.Rollback()

		_, err = tx.Exec(`
			UPDATE purchases SET description = ?, amount_cents = ?, paid_by_user_id = ?, category_id = ?
			WHERE id = ?
		`, req.Description, req.AmountCents, req.PaidByUserID, req.CategoryID, purchaseID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update purchase")
			return
		}

		// Replace assignments
		tx.Exec("DELETE FROM assignments WHERE purchase_id = ?", purchaseID)
		for _, assigneeID := range req.AssignedTo {
			tx.Exec(
				"INSERT INTO assignments (id, purchase_id, user_id) VALUES (?, ?, ?)",
				uuid.New().String(), purchaseID, assigneeID,
			)
		}

		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to commit")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

func deletePurchase(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		purchaseID := chi.URLParam(r, "purchaseID")
		userID := auth.GetUserID(r.Context())

		if !canEditPurchase(db, groupID, purchaseID, userID) {
			writeError(w, http.StatusForbidden, "cannot delete this purchase")
			return
		}

		_, err := db.Exec("DELETE FROM purchases WHERE id = ?", purchaseID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to delete purchase")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

func insertPurchase(db *sqlx.DB, groupID, createdBy string, req purchaseRequest) (string, error) {
	purchaseID := uuid.New().String()

	tx, err := db.Beginx()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO purchases (id, group_id, description, amount_cents, paid_by_user_id, category_id, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, purchaseID, groupID, req.Description, req.AmountCents, req.PaidByUserID, req.CategoryID, createdBy)
	if err != nil {
		return "", err
	}

	for _, assigneeID := range req.AssignedTo {
		_, err = tx.Exec(
			"INSERT INTO assignments (id, purchase_id, user_id) VALUES (?, ?, ?)",
			uuid.New().String(), purchaseID, assigneeID,
		)
		if err != nil {
			return "", err
		}
	}

	return purchaseID, tx.Commit()
}

func canEditPurchase(db *sqlx.DB, groupID, purchaseID, userID string) bool {
	if isAdmin(db, groupID, userID) {
		return true
	}
	var createdBy string
	err := db.Get(&createdBy, "SELECT created_by FROM purchases WHERE id = ? AND group_id = ?", purchaseID, groupID)
	return err == nil && createdBy == userID
}
