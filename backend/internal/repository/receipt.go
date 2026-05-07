package repository

import (
	"context"
	"io"
)

// ReceiptRepository manages receipt metadata in the database.
type ReceiptRepository interface {
	// SetReceiptURL updates the receipt URL on a purchase.
	SetReceiptURL(ctx context.Context, purchaseID, receiptURL string) error
	// PurchaseExists checks if a purchase exists in the given group.
	PurchaseExists(ctx context.Context, groupID, purchaseID string) (bool, error)
}

// ReceiptStorage manages receipt file persistence.
type ReceiptStorage interface {
	// Save persists the receipt file and returns the URL path.
	Save(ctx context.Context, groupID, filename string, content io.Reader) (string, error)
}
