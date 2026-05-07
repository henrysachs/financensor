package api

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/auth"
)

// humaMW is a Huma operation middleware function.
type humaMW = func(ctx huma.Context, next func(huma.Context))

// getUserID extracts the authenticated user ID from context.
func getUserID(ctx context.Context) string {
	return auth.GetUserID(ctx)
}
