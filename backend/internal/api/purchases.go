package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/metrics"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

// --- Input/Output types ---

type PurchaseInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		Description  string   `json:"description" minLength:"1" doc:"Purchase description"`
		AmountCents  int64    `json:"amountCents" doc:"Amount in cents (negative for refunds)"`
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
		AmountCents  int64    `json:"amountCents" doc:"Amount in cents (negative for refunds)"`
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

type PurchaseWithAssignments = repository.PurchaseWithAssignments

type ListPurchasesOutput struct {
	Body []PurchaseWithAssignments
}

// --- Route registration ---

func registerPurchaseRoutes(api huma.API, repo repository.Repository, member humaMW) {
	huma.Register(api, huma.Operation{
		OperationID:  "create-purchase",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/purchases",
		Summary:      "Create a purchase",
		Tags:         []string{"Purchases"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *PurchaseInput) (*CreatePurchaseOutput, error) {
		userID := getUserID(ctx)

		purchaseID, err := repo.Purchases().Create(ctx, repository.CreatePurchaseParams{
			GroupID:      input.GroupID,
			CreatedBy:    userID,
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

		metrics.PurchasesCreatedTotal.Inc()

		resp := &CreatePurchaseOutput{}
		resp.Body.ID = purchaseID
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "create-purchases-bulk",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/purchases/bulk",
		Summary:      "Create multiple purchases",
		Tags:         []string{"Purchases"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *PurchaseBulkInput) (*BulkPurchaseOutput, error) {
		userID := getUserID(ctx)

		params := make([]repository.CreatePurchaseParams, 0, len(input.Body))
		for _, req := range input.Body {
			if req.Description == "" || req.AmountCents == 0 || req.PaidByUserID == "" {
				continue
			}
			params = append(params, repository.CreatePurchaseParams{
				GroupID:      input.GroupID,
				CreatedBy:    userID,
				Description:  req.Description,
				AmountCents:  req.AmountCents,
				PaidByUserID: req.PaidByUserID,
				CategoryID:   req.CategoryID,
				TripID:       req.TripID,
				PurchasedAt:  req.PurchasedAt,
				AssignedTo:   req.AssignedTo,
			})
		}

		var ids []string
		err := repo.WithTx(ctx, func(r repository.Repository) error {
			var txErr error
			ids, txErr = r.Purchases().CreateBulk(ctx, params)
			return txErr
		})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create purchases", err)
		}

		metrics.PurchasesCreatedTotal.Add(float64(len(ids)))

		resp := &BulkPurchaseOutput{}
		resp.Body.IDs = ids
		resp.Body.Count = len(ids)
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "list-purchases",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}/purchases",
		Summary:      "List purchases for a group",
		Tags:         []string{"Purchases"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *GroupPathParams) (*ListPurchasesOutput, error) {
		purchases, err := repo.Purchases().List(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list purchases", err)
		}
		return &ListPurchasesOutput{Body: purchases}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "update-purchase",
		Method:       http.MethodPut,
		Path:         "/groups/{groupID}/purchases/{purchaseID}",
		Summary:      "Update a purchase",
		Tags:         []string{"Purchases"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *UpdatePurchaseInput) (*StatusOutput, error) {
		err := repo.WithTx(ctx, func(r repository.Repository) error {
			return r.Purchases().Update(ctx, input.PurchaseID, repository.UpdatePurchaseParams{
				Description:  input.Body.Description,
				AmountCents:  input.Body.AmountCents,
				PaidByUserID: input.Body.PaidByUserID,
				CategoryID:   input.Body.CategoryID,
				TripID:       input.Body.TripID,
				PurchasedAt:  input.Body.PurchasedAt,
				AssignedTo:   input.Body.AssignedTo,
			})
		})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update purchase", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "updated"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "delete-purchase",
		Method:       http.MethodDelete,
		Path:         "/groups/{groupID}/purchases/{purchaseID}",
		Summary:      "Delete a purchase",
		Tags:         []string{"Purchases"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *PurchasePathParams) (*StatusOutput, error) {
		err := repo.Purchases().Delete(ctx, input.PurchaseID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete purchase", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "deleted"
		return resp, nil
	})
}
