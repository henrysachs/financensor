package api

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/jmoiron/sqlx"
)

type CreateAPIKeyInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		Label           string `json:"label" minLength:"1" doc:"Human-readable label"`
		ActingAsUserID  string `json:"actingAsUserId" minLength:"1" doc:"User ID this key acts as"`
	}
}

type CreateAPIKeyOutput struct {
	Body struct {
		ID              string `json:"id"`
		Label           string `json:"label"`
		ActingAsUserID  string `json:"actingAsUserId"`
		CreatedByUserID string `json:"createdByUserId"`
		Token           string `json:"token"`
		CreatedAt       string `json:"createdAt"`
	}
}

type apiKeyResponse struct {
	ID              string     `json:"id" db:"id"`
	GroupID         string     `json:"groupId" db:"group_id"`
	Label           string     `json:"label" db:"label"`
	ActingAsUserID  string     `json:"actingAsUserId" db:"acting_as_user_id"`
	CreatedByUserID string     `json:"createdByUserId" db:"created_by_user_id"`
	LastUsedAt      *time.Time `json:"lastUsedAt,omitempty" db:"last_used_at"`
	RevokedAt       *time.Time `json:"revokedAt,omitempty" db:"revoked_at"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
}

type ListAPIKeysOutput struct {
	Body []apiKeyResponse
}

type RevokeAPIKeyInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	KeyID   string `path:"keyID" doc:"API key ID"`
}

func registerAPIKeyRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "create-api-key",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/api-keys",
		Summary:     "Create an API key for a group",
		Tags:        []string{"API Keys"},
	}, func(ctx context.Context, input *CreateAPIKeyInput) (*CreateAPIKeyOutput, error) {
		userID := auth.GetUserID(ctx)
		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}
		if !isMember(db, input.GroupID, input.Body.ActingAsUserID) {
			return nil, huma.Error400BadRequest("actingAs user must be a group member")
		}

		token, tokenHash, err := auth.GenerateAPIKey()
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to generate api key", err)
		}

		id := uuid.New().String()
		now := time.Now()
		_, err = db.Exec(
			"INSERT INTO api_keys (id, group_id, label, token_hash, acting_as_user_id, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)",
			id,
			input.GroupID,
			input.Body.Label,
			tokenHash,
			input.Body.ActingAsUserID,
			userID,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create api key", err)
		}

		resp := &CreateAPIKeyOutput{}
		resp.Body.ID = id
		resp.Body.Label = input.Body.Label
		resp.Body.ActingAsUserID = input.Body.ActingAsUserID
		resp.Body.CreatedByUserID = userID
		resp.Body.Token = token
		resp.Body.CreatedAt = now.Format(time.RFC3339)
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-api-keys",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}/api-keys",
		Summary:     "List API keys for a group",
		Tags:        []string{"API Keys"},
	}, func(ctx context.Context, input *GroupPathParams) (*ListAPIKeysOutput, error) {
		userID := auth.GetUserID(ctx)
		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		var keys []apiKeyResponse
		err := db.Select(&keys, `
			SELECT id, group_id, label, acting_as_user_id, created_by_user_id, last_used_at, revoked_at, created_at
			FROM api_keys
			WHERE group_id = ?
			ORDER BY created_at DESC
		`, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list api keys", err)
		}
		if keys == nil {
			keys = []apiKeyResponse{}
		}
		return &ListAPIKeysOutput{Body: keys}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "revoke-api-key",
		Method:      http.MethodDelete,
		Path:        "/groups/{groupID}/api-keys/{keyID}",
		Summary:     "Revoke an API key for a group",
		Tags:        []string{"API Keys"},
	}, func(ctx context.Context, input *RevokeAPIKeyInput) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)
		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		_, err := db.Exec("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND group_id = ? AND revoked_at IS NULL", input.KeyID, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to revoke api key", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "revoked"
		return resp, nil
	})
}
