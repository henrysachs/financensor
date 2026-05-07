// Package repository defines the data access interfaces for the financensor domain.
package repository

import "context"

// Repository is the top-level aggregate providing access to all domain repositories.
// Use WithTx for operations that span multiple aggregates.
type Repository interface {
	Groups() GroupRepository
	Purchases() PurchaseRepository
	Categories() CategoryRepository
	Trips() TripRepository
	Invites() InviteRepository
	Settlements() SettlementRepository
	Users() UserRepository
	Receipts() ReceiptRepository
	APIKeys() APIKeyRepository

	// WithTx executes fn within a single database transaction.
	// All repositories obtained from the Repository passed to fn share the transaction.
	WithTx(ctx context.Context, fn func(Repository) error) error
}
