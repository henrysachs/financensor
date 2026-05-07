package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

type purchaseRepo struct {
	db db
}

func (r *purchaseRepo) Create(ctx context.Context, p repository.CreatePurchaseParams) (string, error) {
	purchaseID := uuid.New().String()

	purchasedAt := "date('now')"
	args := []any{purchaseID, p.GroupID, p.TripID, p.Description, p.AmountCents, p.PaidByUserID, p.CategoryID}
	if p.PurchasedAt != nil && *p.PurchasedAt != "" {
		purchasedAt = "?"
		args = append(args, *p.PurchasedAt)
	}
	args = append(args, p.CreatedBy)

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO purchases (id, group_id, trip_id, description, amount_cents, paid_by_user_id, category_id, purchased_at, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, `+purchasedAt+`, ?)
	`, args...)
	if err != nil {
		return "", err
	}

	for _, assigneeID := range p.AssignedTo {
		_, err = r.db.ExecContext(ctx,
			"INSERT INTO assignments (id, purchase_id, user_id) VALUES (?, ?, ?)",
			uuid.New().String(), purchaseID, assigneeID,
		)
		if err != nil {
			return "", err
		}
	}

	return purchaseID, nil
}

func (r *purchaseRepo) CreateBulk(ctx context.Context, ps []repository.CreatePurchaseParams) ([]string, error) {
	ids := make([]string, 0, len(ps))
	for _, p := range ps {
		id, err := r.Create(ctx, p)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (r *purchaseRepo) List(ctx context.Context, groupID string) ([]repository.PurchaseWithAssignments, error) {
	var purchases []model.Purchase
	err := r.db.SelectContext(ctx, &purchases, `
		SELECT id, group_id, trip_id, description, amount_cents, paid_by_user_id, category_id, receipt_url, purchased_at, created_by, created_at
		FROM purchases WHERE group_id = ? ORDER BY purchased_at DESC, created_at DESC
	`, groupID)
	if err != nil {
		return nil, err
	}

	if len(purchases) == 0 {
		return []repository.PurchaseWithAssignments{}, nil
	}

	// Batch-fetch all assignments for these purchases (fixes N+1)
	purchaseIDs := make([]string, len(purchases))
	for i, p := range purchases {
		purchaseIDs[i] = p.ID
	}

	query, args, err := buildInQuery(
		"SELECT id, purchase_id, user_id, custom_share_cents FROM assignments WHERE purchase_id IN (?)",
		purchaseIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("build IN query: %w", err)
	}

	var allAssignments []model.Assignment
	err = r.db.SelectContext(ctx, &allAssignments, query, args...)
	if err != nil {
		return nil, err
	}

	// Group assignments by purchase ID
	assignmentsByPurchase := make(map[string][]model.Assignment, len(purchases))
	for _, a := range allAssignments {
		assignmentsByPurchase[a.PurchaseID] = append(assignmentsByPurchase[a.PurchaseID], a)
	}

	result := make([]repository.PurchaseWithAssignments, len(purchases))
	for i, p := range purchases {
		assignments := assignmentsByPurchase[p.ID]
		if assignments == nil {
			assignments = []model.Assignment{}
		}
		result[i] = repository.PurchaseWithAssignments{Purchase: p, Assignments: assignments}
	}

	return result, nil
}

func (r *purchaseRepo) Update(ctx context.Context, purchaseID string, p repository.UpdatePurchaseParams) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE purchases SET description = ?, amount_cents = ?, paid_by_user_id = ?, category_id = ?, trip_id = ?, purchased_at = COALESCE(?, purchased_at)
		WHERE id = ?
	`, p.Description, p.AmountCents, p.PaidByUserID, p.CategoryID, p.TripID, p.PurchasedAt, purchaseID)
	if err != nil {
		return err
	}

	_, err = r.db.ExecContext(ctx, "DELETE FROM assignments WHERE purchase_id = ?", purchaseID)
	if err != nil {
		return err
	}

	for _, assigneeID := range p.AssignedTo {
		_, err = r.db.ExecContext(ctx,
			"INSERT INTO assignments (id, purchase_id, user_id) VALUES (?, ?, ?)",
			uuid.New().String(), purchaseID, assigneeID,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *purchaseRepo) Delete(ctx context.Context, purchaseID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM purchases WHERE id = ?", purchaseID)
	return err
}

// buildInQuery expands a single ? placeholder into the correct number for an IN clause.
func buildInQuery(query string, ids []string) (string, []any, error) {
	if len(ids) == 0 {
		return query, nil, nil
	}
	placeholders := strings.Repeat("?,", len(ids))
	placeholders = placeholders[:len(placeholders)-1] // trim trailing comma
	query = strings.Replace(query, "(?)", "("+placeholders+")", 1)
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return query, args, nil
}
