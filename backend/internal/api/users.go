package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/metrics"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

// --- Input/Output types ---

type GetMeOutput struct {
	Body model.User
}

type CreateGhostUserInput struct {
	Body struct {
		Name string `json:"name" minLength:"1" doc:"Ghost user name"`
	}
}

type CreateGhostUserOutput struct {
	Body struct {
		ID string `json:"id" doc:"Created ghost user ID"`
	}
}

type ClaimGhostUserInput struct {
	UserID string `path:"userID" doc:"Ghost user ID to claim"`
}

type AdminClaimGhostInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	UserID  string `path:"userID" doc:"Ghost user ID to merge"`
	Body    struct {
		TargetUserID string `json:"targetUserId" minLength:"1" doc:"Real user ID to merge ghost into"`
	}
}

// --- Route registration ---

func registerUserRoutes(api huma.API, repo repository.Repository) {
	huma.Register(api, huma.Operation{
		OperationID: "get-me",
		Method:      http.MethodGet,
		Path:        "/users/me",
		Summary:     "Get current user",
		Tags:        []string{"Users"},
	}, func(ctx context.Context, input *struct{}) (*GetMeOutput, error) {
		userID := getUserID(ctx)

		user, err := repo.Users().GetByID(ctx, userID)
		if err != nil {
			return nil, huma.Error404NotFound("user not found")
		}
		return &GetMeOutput{Body: user}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "create-ghost-user",
		Method:      http.MethodPost,
		Path:        "/users/ghost",
		Summary:     "Create a ghost user",
		Tags:        []string{"Users"},
	}, func(ctx context.Context, input *CreateGhostUserInput) (*CreateGhostUserOutput, error) {
		id, err := repo.Users().CreateGhost(ctx, input.Body.Name)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create ghost user", err)
		}

		metrics.UsersCreatedTotal.WithLabelValues("ghost").Inc()

		resp := &CreateGhostUserOutput{}
		resp.Body.ID = id
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "claim-ghost-user",
		Method:      http.MethodPost,
		Path:        "/users/{userID}/claim",
		Summary:     "Claim a ghost user account",
		Tags:        []string{"Users"},
	}, func(ctx context.Context, input *ClaimGhostUserInput) (*StatusOutput, error) {
		claimerID := getUserID(ctx)

		err := repo.WithTx(ctx, func(r repository.Repository) error {
			return r.Users().ClaimGhost(ctx, input.UserID, claimerID)
		})
		if err == repository.ErrNotFound {
			return nil, huma.Error404NotFound("user not found")
		}
		if err == repository.ErrConflict {
			return nil, huma.Error400BadRequest("user is not a ghost account")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to claim ghost user", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "claimed"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "admin-merge-ghost",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/members/{userID}/merge",
		Summary:     "Admin: merge a ghost user into a real user",
		Tags:        []string{"Users"},
	}, func(ctx context.Context, input *AdminClaimGhostInput) (*StatusOutput, error) {
		err := repo.WithTx(ctx, func(r repository.Repository) error {
			return r.Users().MergeGhost(ctx, input.GroupID, input.UserID, input.Body.TargetUserID)
		})
		if err == repository.ErrNotFound {
			return nil, huma.Error404NotFound("user not found")
		}
		if err == repository.ErrConflict {
			return nil, huma.Error400BadRequest("user is not a ghost account")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to merge ghost user", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "merged"
		return resp, nil
	})
}
