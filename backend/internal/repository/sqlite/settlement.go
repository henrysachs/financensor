package sqlite

import (
	"context"

	"github.com/henrysachs/financensor/backend/internal/repository"
)

type settlementRepo struct {
	db db
}

func (r *settlementRepo) MarkPaid(ctx context.Context, groupID, settlementID string) error {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		"SELECT EXISTS(SELECT 1 FROM settlements WHERE id = ? AND group_id = ?)",
		settlementID, groupID,
	)
	if err != nil || !exists {
		return repository.ErrNotFound
	}

	_, err = r.db.ExecContext(ctx,
		"UPDATE settlements SET is_paid = 1 WHERE id = ? AND group_id = ?",
		settlementID, groupID,
	)
	return err
}
