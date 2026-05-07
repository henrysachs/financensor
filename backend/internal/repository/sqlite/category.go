package sqlite

import (
	"context"

	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

type categoryRepo struct {
	db db
}

func (r *categoryRepo) Create(ctx context.Context, groupID, name string) (string, error) {
	id := uuid.New().String()
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO categories (id, group_id, name) VALUES (?, ?, ?)",
		id, groupID, name,
	)
	if err != nil {
		return "", repository.ErrConflict
	}
	return id, nil
}

func (r *categoryRepo) CreateDefaults(ctx context.Context, groupID string) error {
	defaults := []string{"Essen", "Getränke", "Alkohol", "Haushalt", "Transport", "Freizeit"}
	for _, name := range defaults {
		id := uuid.New().String()
		_, err := r.db.ExecContext(ctx,
			"INSERT INTO categories (id, group_id, name) VALUES (?, ?, ?)",
			id, groupID, name,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *categoryRepo) List(ctx context.Context, groupID string) ([]model.Category, error) {
	var categories []model.Category
	err := r.db.SelectContext(ctx, &categories,
		"SELECT id, group_id, name FROM categories WHERE group_id = ?", groupID,
	)
	if err != nil {
		return nil, err
	}
	if categories == nil {
		categories = []model.Category{}
	}
	return categories, nil
}

func (r *categoryRepo) Delete(ctx context.Context, groupID, categoryID string) error {
	// Nullify category_id on purchases that reference this category
	_, err := r.db.ExecContext(ctx,
		"UPDATE purchases SET category_id = NULL WHERE category_id = ? AND group_id = ?",
		categoryID, groupID,
	)
	if err != nil {
		return err
	}

	result, err := r.db.ExecContext(ctx,
		"DELETE FROM categories WHERE id = ? AND group_id = ?",
		categoryID, groupID,
	)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return repository.ErrNotFound
	}
	return nil
}
