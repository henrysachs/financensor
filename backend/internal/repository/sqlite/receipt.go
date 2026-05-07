package sqlite

import (
	"context"

	"github.com/henrysachs/financensor/backend/internal/repository"
)

type receiptRepo struct {
	db db
}

func (r *receiptRepo) SetReceiptURL(ctx context.Context, purchaseID, receiptURL string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE purchases SET receipt_url = ? WHERE id = ?", receiptURL, purchaseID,
	)
	return err
}

func (r *receiptRepo) PurchaseExists(ctx context.Context, groupID, purchaseID string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		"SELECT COUNT(*) FROM purchases WHERE id = ? AND group_id = ?", purchaseID, groupID,
	)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// localReceiptStorage implements repository.ReceiptStorage using the local filesystem.
// This is defined here for convenience but could be moved to its own file if it grows.
var _ repository.ReceiptStorage = (*LocalReceiptStorage)(nil)

// LocalReceiptStorage is exported so it can be wired in main.
type LocalReceiptStorage struct {
	UploadsDir string
}
