// Package sqlite implements repository.Repository backed by SQLite via sqlx.
package sqlite

import (
	"context"
	"fmt"

	"github.com/henrysachs/financensor/backend/internal/repository"
	"github.com/jmoiron/sqlx"
)

// db is the common interface between *sqlx.DB and *sqlx.Tx that our repositories use.
type db interface {
	sqlx.ExtContext
	sqlx.ExecerContext
	GetContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error
	SelectContext(ctx context.Context, dest interface{}, query string, args ...interface{}) error
}

// Repo implements repository.Repository using SQLite.
type Repo struct {
	conn db
}

// New creates a new SQLite-backed Repository.
func New(sqlxDB *sqlx.DB) *Repo {
	return &Repo{conn: sqlxDB}
}

func (r *Repo) Groups() repository.GroupRepository         { return &groupRepo{db: r.conn} }
func (r *Repo) Purchases() repository.PurchaseRepository   { return &purchaseRepo{db: r.conn} }
func (r *Repo) Categories() repository.CategoryRepository  { return &categoryRepo{db: r.conn} }
func (r *Repo) Trips() repository.TripRepository           { return &tripRepo{db: r.conn} }
func (r *Repo) Invites() repository.InviteRepository       { return &inviteRepo{db: r.conn} }
func (r *Repo) Settlements() repository.SettlementRepository { return &settlementRepo{db: r.conn} }
func (r *Repo) Users() repository.UserRepository           { return &userRepo{db: r.conn} }
func (r *Repo) Receipts() repository.ReceiptRepository     { return &receiptRepo{db: r.conn} }
func (r *Repo) APIKeys() repository.APIKeyRepository       { return &apiKeyRepo{db: r.conn} }

func (r *Repo) WithTx(ctx context.Context, fn func(repository.Repository) error) error {
	// If we're already inside a transaction, just run fn directly.
	if _, ok := r.conn.(*sqlx.Tx); ok {
		return fn(r)
	}

	sqlxDB, ok := r.conn.(*sqlx.DB)
	if !ok {
		return fmt.Errorf("cannot start transaction: underlying connection is not *sqlx.DB")
	}

	tx, err := sqlxDB.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	txRepo := &Repo{conn: tx}
	if err := fn(txRepo); err != nil {
		return err
	}

	return tx.Commit()
}
