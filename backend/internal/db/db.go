package db

import (
	"fmt"

	"github.com/XSAM/otelsql"
	"github.com/jmoiron/sqlx"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	_ "modernc.org/sqlite"
)

func Open(path string) (*sqlx.DB, error) {
	dsn := fmt.Sprintf("file:%s?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=on", path)

	// Use otelsql.Open to get a *sql.DB with automatic OTEL span creation for all queries.
	sqlDB, err := otelsql.Open("sqlite", dsn,
		otelsql.WithAttributes(semconv.DBSystemSqlite),
		otelsql.WithSpanOptions(otelsql.SpanOptions{
			DisableErrSkip: true,
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	db := sqlx.NewDb(sqlDB, "sqlite")
	db.SetMaxOpenConns(1)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	// Record DB connection pool stats as OTEL metrics.
	if _, err := otelsql.RegisterDBStatsMetrics(sqlDB,
		otelsql.WithAttributes(semconv.DBSystemSqlite),
	); err != nil {
		fmt.Printf("otelsql.RegisterDBStatsMetrics: %v\n", err)
	}

	return db, nil
}
