package api

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

// requireMember returns a Huma middleware that checks the authenticated user is a member of the group.
func requireMember(humaAPI huma.API, repo repository.Repository) func(ctx huma.Context, next func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		groupID := ctx.Param("groupID")
		if groupID == "" {
			huma.WriteErr(humaAPI, ctx, 400, "missing groupID")
			return
		}

		userID := auth.GetUserID(ctx.Context())
		if userID == "" {
			huma.WriteErr(humaAPI, ctx, 401, "not authenticated")
			return
		}

		ok, err := repo.Groups().IsMember(ctx.Context(), groupID, userID)
		if err != nil || !ok {
			huma.WriteErr(humaAPI, ctx, 403, "not a member of this group")
			return
		}

		next(ctx)
	}
}

// requireAdmin returns a Huma middleware that checks the authenticated user is an admin of the group.
func requireAdmin(humaAPI huma.API, repo repository.Repository) func(ctx huma.Context, next func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		groupID := ctx.Param("groupID")
		if groupID == "" {
			huma.WriteErr(humaAPI, ctx, 400, "missing groupID")
			return
		}

		userID := auth.GetUserID(ctx.Context())
		if userID == "" {
			huma.WriteErr(humaAPI, ctx, 401, "not authenticated")
			return
		}

		ok, err := repo.Groups().IsAdmin(ctx.Context(), groupID, userID)
		if err != nil || !ok {
			huma.WriteErr(humaAPI, ctx, 403, "admin only")
			return
		}

		next(ctx)
	}
}
