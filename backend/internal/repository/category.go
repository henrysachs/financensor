package repository

import (
	"context"

	"github.com/henrysachs/financensor/backend/internal/model"
)

// CategoryRepository manages category persistence.
type CategoryRepository interface {
	Create(ctx context.Context, groupID, name string) (string, error)
	CreateDefaults(ctx context.Context, groupID string) error
	List(ctx context.Context, groupID string) ([]model.Category, error)
	Delete(ctx context.Context, groupID, categoryID string) error
}
