package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/metrics"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/jmoiron/sqlx"
)

// --- Input/Output types ---

type PurchaseInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		Description  string   `json:"description" minLength:"1" doc:"Purchase description"`
		AmountCents  int64    `json:"amountCents" minimum:"1" doc:"Amount in cents"`
		PaidByUserID string   `json:"paidByUserId" minLength:"1" doc:"User who paid"`
		CategoryID   *string  `json:"categoryId,omitempty" doc:"Category ID"`
		TripID       *string  `json:"tripId,omitempty" doc:"Trip ID"`
		PurchasedAt  *string  `json:"purchasedAt,omitempty" doc:"Date of purchase (YYYY-MM-DD)"`
		AssignedTo   []string `json:"assignedTo" doc:"User IDs to split between"`
	}
}

type PurchaseBulkInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    []struct {
		Description  string   `json:"description" minLength:"1" doc:"Purchase description"`
		AmountCents  int64    `json:"amountCents" minimum:"1" doc:"Amount in cents"`
		PaidByUserID string   `json:"paidByUserId" minLength:"1" doc:"User who paid"`
		CategoryID   *string  `json:"categoryId,omitempty" doc:"Category ID"`
		TripID       *string  `json:"tripId,omitempty" doc:"Trip ID"`
		PurchasedAt  *string  `json:"purchasedAt,omitempty" doc:"Date of purchase (YYYY-MM-DD)"`
		AssignedTo   []string `json:"assignedTo" doc:"User IDs to split between"`
	}
}

type PurchasePathParams struct {
	GroupID    string `path:"groupID" doc:"Group ID"`
	PurchaseID string `path:"purchaseID" doc:"Purchase ID"`
}

type UpdatePurchaseInput struct {
	GroupID    string `path:"groupID" doc:"Group ID"`
	PurchaseID string `path:"purchaseID" doc:"Purchase ID"`
	Body       struct {
		Description  string   `json:"description" doc:"Purchase description"`
		AmountCents  int64    `json:"amountCents" doc:"Amount in cents"`
		PaidByUserID string   `json:"paidByUserId" doc:"User who paid"`
		CategoryID   *string  `json:"categoryId,omitempty" doc:"Category ID"`
		TripID       *string  `json:"tripId,omitempty" doc:"Trip ID"`
		PurchasedAt  *string  `json:"purchasedAt,omitempty" doc:"Date of purchase (YYYY-MM-DD)"`
		AssignedTo   []string `json:"assignedTo" doc:"User IDs to split between"`
	}
}

type CreatePurchaseOutput struct {
	Body struct {
		ID string `json:"id" doc:"Created purchase ID"`
	}
}

type BulkPurchaseOutput struct {
	Body struct {
		IDs   []string `json:"ids" doc:"Created purchase IDs"`
		Count int      `json:"count" doc:"Number of purchases created"`
	}
}

type PurchaseWithAssignments struct {
	model.Purchase
	Assignments []model.Assignment `json:"assignments"`
}

type ListPurchasesOutput struct {
	Body []PurchaseWithAssignments
}

// --- Route registration ---

func registerPurchaseRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "create-purchase",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/purchases",
		Summary:     "Create a purchase",
		Tags:        []string{"Purchases"},
	}, func(ctx context.Context, input *PurchaseInput) (*CreatePurchaseOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		purchaseID, err := insertPurchase(db, input.GroupID, userID, purchaseReq{
			Description:  input.Body.Description,
			AmountCents:  input.Body.AmountCents,
			PaidByUserID: input.Body.PaidByUserID,
			CategoryID:   input.Body.CategoryID,
			TripID:       input.Body.TripID,
			PurchasedAt:  input.Body.PurchasedAt,
			AssignedTo:   input.Body.AssignedTo,
		})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create purchase", err)
		}

		resp := &CreatePurchaseOutput{}
		resp.Body.ID = purchaseID
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-purchases-bulk",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/purchases/bulk",
		Summary:     "Create multiple purchases",
		Tags:        []string{"Purchases"},
	}, func(ctx context.Context, input *PurchaseBulkInput) (*BulkPurchaseOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		ids := make([]string, 0, len(input.Body))
		for _, req := range input.Body {
			if req.Description == "" || req.AmountCents <= 0 || req.PaidByUserID == "" {
				continue
			}
			id, err := insertPurchase(db, input.GroupID, userID, purchaseReq{
				Description:  req.Description,
				AmountCents:  req.AmountCents,
				PaidByUserID: req.PaidByUserID,
				CategoryID:   req.CategoryID,
				TripID:       req.TripID,
				PurchasedAt:  req.PurchasedAt,
				AssignedTo:   req.AssignedTo,
			})
			if err != nil {
				return nil, huma.Error500InternalServerError("failed to create purchase", err)
			}
			ids = append(ids, id)
		}

		resp := &BulkPurchaseOutput{}
		resp.Body.IDs = ids
		resp.Body.Count = len(ids)
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-purchases",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}/purchases",
		Summary:     "List purchases for a group",
		Tags:        []string{"Purchases"},
	}, func(ctx context.Context, input *GroupPathParams) (*ListPurchasesOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		var purchases []model.Purchase
		err := db.Select(&purchases, `
			SELECT id, group_id, trip_id, description, amount_cents, paid_by_user_id, category_id, receipt_url, purchased_at, created_by, created_at
			FROM purchases WHERE group_id = ? ORDER BY purchased_at DESC, created_at DESC
		`, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list purchases", err)
		}

		result := make([]PurchaseWithAssignments, 0, len(purchases))
		for _, p := range purchases {
			var assignments []model.Assignment
			db.Select(&assignments, "SELECT id, purchase_id, user_id, custom_share_cents FROM assignments WHERE purchase_id = ?", p.ID)
			if assignments == nil {
				assignments = []model.Assignment{}
			}
			result = append(result, PurchaseWithAssignments{Purchase: p, Assignments: assignments})
		}

		return &ListPurchasesOutput{Body: result}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-purchase",
		Method:      http.MethodPut,
		Path:        "/groups/{groupID}/purchases/{purchaseID}",
		Summary:     "Update a purchase",
		Tags:        []string{"Purchases"},
	}, func(ctx context.Context, input *UpdatePurchaseInput) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !canEditPurchase(db, input.GroupID, input.PurchaseID, userID) {
			return nil, huma.Error403Forbidden("cannot edit this purchase")
		}

		tx, err := db.Beginx()
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to begin transaction", err)
		}
		defer tx.Rollback()

		_, err = tx.Exec(`
			UPDATE purchases SET description = ?, amount_cents = ?, paid_by_user_id = ?, category_id = ?, trip_id = ?, purchased_at = COALESCE(?, purchased_at)
			WHERE id = ?
		`, input.Body.Description, input.Body.AmountCents, input.Body.PaidByUserID, input.Body.CategoryID, input.Body.TripID, input.Body.PurchasedAt, input.PurchaseID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update purchase", err)
		}

		tx.Exec("DELETE FROM assignments WHERE purchase_id = ?", input.PurchaseID)
		for _, assigneeID := range input.Body.AssignedTo {
			tx.Exec(
				"INSERT INTO assignments (id, purchase_id, user_id) VALUES (?, ?, ?)",
				uuid.New().String(), input.PurchaseID, assigneeID,
			)
		}

		if err := tx.Commit(); err != nil {
			return nil, huma.Error500InternalServerError("failed to commit", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "updated"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-purchase",
		Method:      http.MethodDelete,
		Path:        "/groups/{groupID}/purchases/{purchaseID}",
		Summary:     "Delete a purchase",
		Tags:        []string{"Purchases"},
	}, func(ctx context.Context, input *PurchasePathParams) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !canEditPurchase(db, input.GroupID, input.PurchaseID, userID) {
			return nil, huma.Error403Forbidden("cannot delete this purchase")
		}

		_, err := db.Exec("DELETE FROM purchases WHERE id = ?", input.PurchaseID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete purchase", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "deleted"
		return resp, nil
	})
}

// --- Helpers ---

type purchaseReq struct {
	Description  string
	AmountCents  int64
	PaidByUserID string
	CategoryID   *string
	TripID       *string
	PurchasedAt  *string
	AssignedTo   []string
}

func insertPurchase(db *sqlx.DB, groupID, createdBy string, req purchaseReq) (string, error) {
	purchaseID := uuid.New().String()

	tx, err := db.Beginx()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	purchasedAt := "date('now')"
	args := []any{purchaseID, groupID, req.TripID, req.Description, req.AmountCents, req.PaidByUserID, req.CategoryID}
	if req.PurchasedAt != nil && *req.PurchasedAt != "" {
		purchasedAt = "?"
		args = append(args, *req.PurchasedAt)
	}
	args = append(args, createdBy)

	_, err = tx.Exec(`
		INSERT INTO purchases (id, group_id, trip_id, description, amount_cents, paid_by_user_id, category_id, purchased_at, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, `+purchasedAt+`, ?)
	`, args...)
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

	if err := tx.Commit(); err != nil {
		return "", err
	}
	metrics.PurchasesCreatedTotal.Inc()
	return purchaseID, nil
}

func canEditPurchase(db *sqlx.DB, groupID, purchaseID, userID string) bool {
	// Any group member can edit purchases
	return isMember(db, groupID, userID)
}
