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
