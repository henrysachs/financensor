package db

import (
	"context"
	"database/sql"
	"time"

	"github.com/henrysachs/financensor/backend/internal/metrics"
	"github.com/jmoiron/sqlx"
)

// InstrumentedDB wraps sqlx.DB to record query durations.
type InstrumentedDB struct {
	*sqlx.DB
}

// Wrap returns an InstrumentedDB that records query durations.
func Wrap(db *sqlx.DB) *InstrumentedDB {
	return &InstrumentedDB{DB: db}
}

func (d *InstrumentedDB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	start := time.Now()
	result, err := d.DB.ExecContext(ctx, query, args...)
	metrics.DBQueryDuration.WithLabelValues("exec").Observe(time.Since(start).Seconds())
	return result, err
}

func (d *InstrumentedDB) GetContext(ctx context.Context, dest any, query string, args ...any) error {
	start := time.Now()
	err := d.DB.GetContext(ctx, dest, query, args...)
	metrics.DBQueryDuration.WithLabelValues("get").Observe(time.Since(start).Seconds())
	return err
}

func (d *InstrumentedDB) SelectContext(ctx context.Context, dest any, query string, args ...any) error {
	start := time.Now()
	err := d.DB.SelectContext(ctx, dest, query, args...)
	metrics.DBQueryDuration.WithLabelValues("select").Observe(time.Since(start).Seconds())
	return err
}

func (d *InstrumentedDB) Exec(query string, args ...any) (sql.Result, error) {
	start := time.Now()
	result, err := d.DB.Exec(query, args...)
	metrics.DBQueryDuration.WithLabelValues("exec").Observe(time.Since(start).Seconds())
	return result, err
}

func (d *InstrumentedDB) Get(dest any, query string, args ...any) error {
	start := time.Now()
	err := d.DB.Get(dest, query, args...)
	metrics.DBQueryDuration.WithLabelValues("get").Observe(time.Since(start).Seconds())
	return err
}

func (d *InstrumentedDB) Select(dest any, query string, args ...any) error {
	start := time.Now()
	err := d.DB.Select(dest, query, args...)
	metrics.DBQueryDuration.WithLabelValues("select").Observe(time.Since(start).Seconds())
	return err
}
