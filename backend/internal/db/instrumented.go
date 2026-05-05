package db

import (
	"time"

	"github.com/henrysachs/financensor/backend/internal/metrics"
)

// ObserveQuery records the duration of a database operation.
// Usage:
//
//	defer db.ObserveQuery("select")()
//	err := db.Select(&results, query, args...)
func ObserveQuery(operation string) func() {
	start := time.Now()
	return func() {
		metrics.DBQueryDuration.WithLabelValues(operation).Observe(time.Since(start).Seconds())
	}
}
