package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"go.opentelemetry.io/otel/trace"
)

// responseWriter wraps http.ResponseWriter to capture status code and bytes written.
type responseWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
	bytes       int
}

func (rw *responseWriter) WriteHeader(code int) {
	if !rw.wroteHeader {
		rw.status = code
		rw.wroteHeader = true
	}
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.wroteHeader {
		rw.WriteHeader(http.StatusOK)
	}
	n, err := rw.ResponseWriter.Write(b)
	rw.bytes += n
	return n, err
}

func (rw *responseWriter) Unwrap() http.ResponseWriter {
	return rw.ResponseWriter
}

// SlogRequestLogger logs each request as structured JSON with traceID.
func SlogRequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		reqID := middleware.GetReqID(r.Context())

		ww := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(ww, r)

		duration := time.Since(start)

		// Extract trace ID from span context
		spanCtx := trace.SpanFromContext(r.Context()).SpanContext()
		traceID := ""
		spanID := ""
		if spanCtx.HasTraceID() {
			traceID = spanCtx.TraceID().String()
		}
		if spanCtx.HasSpanID() {
			spanID = spanCtx.SpanID().String()
		}

		// Normalize route pattern for logging
		routePattern := normalizeRoute(r)

		attrs := []slog.Attr{
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.String("route", routePattern),
			slog.Int("status", ww.status),
			slog.Int("bytes", ww.bytes),
			slog.Duration("duration", duration),
			slog.String("remote", r.RemoteAddr),
			slog.String("requestId", reqID),
		}

		if traceID != "" {
			attrs = append(attrs, slog.String("traceID", traceID))
		}
		if spanID != "" {
			attrs = append(attrs, slog.String("spanID", spanID))
		}

		if ua := r.UserAgent(); ua != "" {
			attrs = append(attrs, slog.String("userAgent", ua))
		}

		level := slog.LevelInfo
		if ww.status >= 500 {
			level = slog.LevelError
		} else if ww.status >= 400 {
			level = slog.LevelWarn
		}

		slog.LogAttrs(r.Context(), level, "http request", attrs...)
	})
}

// normalizeRoute extracts the chi route pattern, replacing dynamic segments with placeholders.
func normalizeRoute(r *http.Request) string {
	rctx := chi.RouteContext(r.Context())
	if rctx == nil || rctx.RoutePattern() == "" {
		return r.URL.Path
	}
	pattern := rctx.RoutePattern()
	// Clean up double slashes from chi nesting
	pattern = strings.ReplaceAll(pattern, "//", "/")
	return pattern
}
