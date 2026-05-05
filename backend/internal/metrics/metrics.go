package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Business counters
var (
	PurchasesCreatedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "financensor_purchases_created_total",
		Help: "Total number of purchases created.",
	})

	GroupsCreatedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "financensor_groups_created_total",
		Help: "Total number of groups created.",
	})

	UsersCreatedTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "financensor_users_created_total",
		Help: "Total number of users created.",
	}, []string{"type"}) // type: "oauth" or "ghost"
)

// DB metrics
var (
	DBQueryDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "financensor_db_query_duration_seconds",
		Help:    "Duration of database queries in seconds.",
		Buckets: []float64{0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1},
	}, []string{"operation"})
)
