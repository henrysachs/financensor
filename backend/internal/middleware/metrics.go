package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests by method, route, and status code.",
		},
		[]string{"method", "route", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds by method and route.",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"method", "route"},
	)

	httpResponseBytes = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_response_bytes",
			Help:    "HTTP response size in bytes.",
			Buckets: []float64{100, 500, 1000, 5000, 10000, 50000, 100000, 500000},
		},
		[]string{"method", "route"},
	)
)

// PrometheusMetrics records HTTP metrics for each request.
// Must be placed after the router has matched (so chi route pattern is available).
func PrometheusMetrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		ww := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(ww, r)

		duration := time.Since(start)
		route := normalizeRoute(r)
		method := r.Method
		status := strconv.Itoa(ww.status)

		httpRequestsTotal.WithLabelValues(method, route, status).Inc()
		httpRequestDuration.WithLabelValues(method, route).Observe(duration.Seconds())
		httpResponseBytes.WithLabelValues(method, route).Observe(float64(ww.bytes))
	})
}
