package repository

import (
	"context"

	"github.com/henrysachs/financensor/backend/internal/model"
)

// PurchaseWithAssignments pairs a purchase with its cost assignments.
type PurchaseWithAssignments struct {
	model.Purchase
	Assignments []model.Assignment `json:"assignments"`
}

// CreatePurchaseParams holds the data needed to insert a purchase.
type CreatePurchaseParams struct {
	GroupID      string
	CreatedBy    string
	Description  string
	AmountCents  int64
	PaidByUserID string
	CategoryID   *string
	TripID       *string
	PurchasedAt  *string
	AssignedTo   []string
}

// UpdatePurchaseParams holds the data needed to update a purchase.
type UpdatePurchaseParams struct {
	Description  string
	AmountCents  int64
	PaidByUserID string
	CategoryID   *string
	TripID       *string
	PurchasedAt  *string
	AssignedTo   []string
}

// PurchaseRepository manages purchase and assignment persistence.
type PurchaseRepository interface {
	Create(ctx context.Context, p CreatePurchaseParams) (string, error)
	CreateBulk(ctx context.Context, ps []CreatePurchaseParams) ([]string, error)
	List(ctx context.Context, groupID string) ([]PurchaseWithAssignments, error)
	Update(ctx context.Context, purchaseID string, p UpdatePurchaseParams) error
	Delete(ctx context.Context, purchaseID string) error
}
