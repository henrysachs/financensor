package repository

import (
	"context"

	"github.com/henrysachs/financensor/backend/internal/model"
)

// TripWithTotal is a trip with aggregated purchase stats.
type TripWithTotal struct {
	model.Trip
	TotalCents    int64 `db:"total_cents" json:"totalCents"`
	PurchaseCount int   `db:"purchase_count" json:"purchaseCount"`
}

// CreateTripParams holds the data needed to insert a trip.
type CreateTripParams struct {
	GroupID     string
	Name        string
	Description *string
	TripDate    *string
	CreatedBy   string
}

// UpdateTripParams holds the data needed to update a trip.
type UpdateTripParams struct {
	Name        string
	Description *string
	TripDate    *string
}

// TripRepository manages trip persistence.
type TripRepository interface {
	Create(ctx context.Context, p CreateTripParams) (model.Trip, error)
	List(ctx context.Context, groupID string) ([]TripWithTotal, error)
	Get(ctx context.Context, groupID, tripID string) (model.Trip, error)
	Update(ctx context.Context, groupID, tripID string, p UpdateTripParams) (model.Trip, error)
	Delete(ctx context.Context, groupID, tripID string) error
}
