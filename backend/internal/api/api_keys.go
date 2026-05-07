package api

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

// --- Input/Output types ---

type CreateAPIKeyInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		Label          string `json:"label" minLength:"1" doc:"Human-readable label"`
		ActingAsUserID string `json:"actingAsUserId" minLength:"1" doc:"User ID this key acts as"`
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

type ListAPIKeysOutput struct {
	Body []repository.APIKeyRow
}

type RevokeAPIKeyInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	KeyID   string `path:"keyID" doc:"API key ID"`
}

// --- Route registration ---

func registerAPIKeyRoutes(api huma.API, repo repository.Repository, admin humaMW) {
	huma.Register(api, huma.Operation{
		OperationID:  "create-api-key",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/api-keys",
		Summary:      "Create an API key for a group",
		Tags:         []string{"API Keys"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *CreateAPIKeyInput) (*CreateAPIKeyOutput, error) {
		userID := getUserID(ctx)

		isMember, _ := repo.Groups().IsMember(ctx, input.GroupID, input.Body.ActingAsUserID)
		if !isMember {
			return nil, huma.Error400BadRequest("actingAs user must be a group member")
		}

		token, tokenHash, err := auth.GenerateAPIKey()
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to generate api key", err)
		}

		id, err := repo.APIKeys().Create(ctx, repository.CreateAPIKeyParams{
			GroupID:         input.GroupID,
			Label:           input.Body.Label,
			TokenHash:       tokenHash,
			ActingAsUserID:  input.Body.ActingAsUserID,
			CreatedByUserID: userID,
		})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create api key", err)
		}

		resp := &CreateAPIKeyOutput{}
		resp.Body.ID = id
		resp.Body.Label = input.Body.Label
		resp.Body.ActingAsUserID = input.Body.ActingAsUserID
		resp.Body.CreatedByUserID = userID
		resp.Body.Token = token
		resp.Body.CreatedAt = time.Now().Format(time.RFC3339)
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "list-api-keys",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}/api-keys",
		Summary:      "List API keys for a group",
		Tags:         []string{"API Keys"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *GroupPathParams) (*ListAPIKeysOutput, error) {
		keys, err := repo.APIKeys().List(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list api keys", err)
		}
		return &ListAPIKeysOutput{Body: keys}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "revoke-api-key",
		Method:       http.MethodDelete,
		Path:         "/groups/{groupID}/api-keys/{keyID}",
		Summary:      "Revoke an API key for a group",
		Tags:         []string{"API Keys"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *RevokeAPIKeyInput) (*StatusOutput, error) {
		err := repo.APIKeys().Revoke(ctx, input.GroupID, input.KeyID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to revoke api key", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "revoked"
		return resp, nil
	})
}
