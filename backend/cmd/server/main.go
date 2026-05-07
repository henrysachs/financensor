package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/henrysachs/financensor/backend/internal/api"
	"github.com/henrysachs/financensor/backend/internal/db"
	"github.com/henrysachs/financensor/backend/internal/repository/sqlite"
	"github.com/henrysachs/financensor/backend/internal/telemetry"
	"github.com/joho/godotenv"
)

func main() {
	// Health check mode for Docker healthcheck (no shell in chainguard/static)
	if len(os.Args) > 1 && os.Args[1] == "-health" {
		resp, err := http.Get("http://localhost:8080/health")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	_ = godotenv.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	// Initialize tracing
	ctx := context.Background()
	shutdownTracing := telemetry.Init(ctx, "financensor-backend", "1.0.0")
	defer shutdownTracing(ctx)

	dbPath := envOrDefault("DB_PATH", "financensor.db")
	database, err := db.Open(dbPath)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	repo := sqlite.New(database)
	storage := &sqlite.LocalReceiptStorage{UploadsDir: "uploads"}

	router := api.NewRouter(repo, storage)

	srv := &http.Server{
		Addr:         ":8080",
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("server starting", "addr", srv.Addr, "db", dbPath)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func init() {
	// Ensure data/uploads dirs exist (chainguard has no shell to mkdir)
	for _, dir := range []string{"data", "uploads", "/app/data", "/app/uploads"} {
		os.MkdirAll(dir, 0o755)
	}
}
