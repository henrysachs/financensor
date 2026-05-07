package repository

import "context"

// SettlementRepository manages persisted settlement records.
type SettlementRepository interface {
	MarkPaid(ctx context.Context, groupID, settlementID string) error
}
