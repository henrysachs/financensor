package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/jmoiron/sqlx"
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

func registerUserRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "get-me",
		Method:      http.MethodGet,
		Path:        "/users/me",
		Summary:     "Get current user",
		Tags:        []string{"Users"},
	}, func(ctx context.Context, input *struct{}) (*GetMeOutput, error) {
		userID := auth.GetUserID(ctx)

		var user model.User
		err := db.Get(&user, "SELECT id, name, email, avatar_url, is_ghost, created_at FROM users WHERE id = ?", userID)
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
		id := uuid.New().String()
		_, err := db.Exec(
			"INSERT INTO users (id, name, is_ghost) VALUES (?, ?, 1)",
			id, input.Body.Name,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create ghost user", err)
		}

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
		claimerID := auth.GetUserID(ctx)

		var target model.User
		err := db.Get(&target, "SELECT id, is_ghost FROM users WHERE id = ?", input.UserID)
		if err != nil {
			return nil, huma.Error404NotFound("user not found")
		}

		if !target.IsGhost {
			return nil, huma.Error400BadRequest("user is not a ghost account")
		}

		tx, err := db.Beginx()
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to begin transaction", err)
		}
		defer tx.Rollback()

		tx.Exec("UPDATE group_members SET user_id = ? WHERE user_id = ?", claimerID, input.UserID)
		tx.Exec("UPDATE purchases SET paid_by_user_id = ? WHERE paid_by_user_id = ?", claimerID, input.UserID)
		tx.Exec("UPDATE purchases SET created_by = ? WHERE created_by = ?", claimerID, input.UserID)
		tx.Exec("UPDATE assignments SET user_id = ? WHERE user_id = ?", claimerID, input.UserID)
		tx.Exec("UPDATE settlements SET from_user_id = ? WHERE from_user_id = ?", claimerID, input.UserID)
		tx.Exec("UPDATE settlements SET to_user_id = ? WHERE to_user_id = ?", claimerID, input.UserID)
		tx.Exec("DELETE FROM users WHERE id = ?", input.UserID)

		if err := tx.Commit(); err != nil {
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
		adminID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, adminID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		var target model.User
		err := db.Get(&target, "SELECT id, is_ghost FROM users WHERE id = ?", input.UserID)
		if err != nil {
			return nil, huma.Error404NotFound("ghost user not found")
		}
		if !target.IsGhost {
			return nil, huma.Error400BadRequest("user is not a ghost account")
		}

		// Verify target user exists
		var targetExists bool
		err = db.Get(&targetExists, "SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)", input.Body.TargetUserID)
		if err != nil || !targetExists {
			return nil, huma.Error404NotFound("target user not found")
		}

		tx, err := db.Beginx()
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to begin transaction", err)
		}
		defer tx.Rollback()

		// Transfer all references from ghost to target
		tx.Exec("UPDATE purchases SET paid_by_user_id = ? WHERE paid_by_user_id = ?", input.Body.TargetUserID, input.UserID)
		tx.Exec("UPDATE purchases SET created_by = ? WHERE created_by = ?", input.Body.TargetUserID, input.UserID)
		tx.Exec("UPDATE assignments SET user_id = ? WHERE user_id = ?", input.Body.TargetUserID, input.UserID)
		tx.Exec("UPDATE settlements SET from_user_id = ? WHERE from_user_id = ?", input.Body.TargetUserID, input.UserID)
		tx.Exec("UPDATE settlements SET to_user_id = ? WHERE to_user_id = ?", input.Body.TargetUserID, input.UserID)

		// Remove ghost from group_members (target should already be a member)
		tx.Exec("DELETE FROM group_members WHERE user_id = ? AND group_id = ?", input.UserID, input.GroupID)

		// Delete ghost user
		tx.Exec("DELETE FROM users WHERE id = ?", input.UserID)

		if err := tx.Commit(); err != nil {
			return nil, huma.Error500InternalServerError("failed to merge ghost user", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "merged"
		return resp, nil
	})
}
