package api

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

// --- Input/Output types ---

type CreateInviteInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		MaxUses   *int `json:"maxUses,omitempty" doc:"Max number of uses (null = unlimited)"`
		ExpiresIn *int `json:"expiresIn,omitempty" doc:"Expiry in hours (null = never)"`
	}
}

type InviteOutput struct {
	Body struct {
		ID        string  `json:"id" doc:"Invite ID (use as token in link)"`
		GroupID   string  `json:"groupId"`
		MaxUses   *int    `json:"maxUses,omitempty"`
		UseCount  int     `json:"useCount"`
		ExpiresAt *string `json:"expiresAt,omitempty"`
		CreatedAt string  `json:"createdAt"`
	}
}

type ListInvitesOutput struct {
	Body []repository.Invite
}

type AcceptInviteInput struct {
	InviteID string `path:"inviteID" doc:"Invite token"`
}

type AcceptInviteOutput struct {
	Body struct {
		GroupID   string `json:"groupId"`
		GroupName string `json:"groupName"`
	}
}

type DeleteInviteInput struct {
	GroupID  string `path:"groupID" doc:"Group ID"`
	InviteID string `path:"inviteID" doc:"Invite ID"`
}

// --- Route registration ---

func registerInviteRoutes(api huma.API, repo repository.Repository, member humaMW, admin humaMW) {
	huma.Register(api, huma.Operation{
		OperationID:  "create-invite",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/invites",
		Summary:      "Create an invite link for a group",
		Tags:         []string{"Invites"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *CreateInviteInput) (*InviteOutput, error) {
		var expiresAt *time.Time
		if input.Body.ExpiresIn != nil {
			t := time.Now().Add(time.Duration(*input.Body.ExpiresIn) * time.Hour)
			expiresAt = &t
		}

		userID := getUserID(ctx)
		invite, err := repo.Invites().Create(ctx, repository.CreateInviteParams{
			GroupID:   input.GroupID,
			CreatedBy: userID,
			MaxUses:   input.Body.MaxUses,
			ExpiresAt: expiresAt,
		})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create invite", err)
		}

		resp := &InviteOutput{}
		resp.Body.ID = invite.ID
		resp.Body.GroupID = invite.GroupID
		resp.Body.MaxUses = invite.MaxUses
		resp.Body.UseCount = invite.UseCount
		resp.Body.ExpiresAt = invite.ExpiresAt
		resp.Body.CreatedAt = invite.CreatedAt
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "list-invites",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}/invites",
		Summary:      "List active invites for a group",
		Tags:         []string{"Invites"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *GroupPathParams) (*ListInvitesOutput, error) {
		invites, err := repo.Invites().List(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list invites", err)
		}
		return &ListInvitesOutput{Body: invites}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "delete-invite",
		Method:       http.MethodDelete,
		Path:         "/groups/{groupID}/invites/{inviteID}",
		Summary:      "Delete an invite",
		Tags:         []string{"Invites"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *DeleteInviteInput) (*StatusOutput, error) {
		err := repo.Invites().Delete(ctx, input.GroupID, input.InviteID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete invite", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "deleted"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "accept-invite",
		Method:      http.MethodPost,
		Path:        "/invites/{inviteID}/accept",
		Summary:     "Accept an invite and join the group",
		Tags:        []string{"Invites"},
	}, func(ctx context.Context, input *AcceptInviteInput) (*AcceptInviteOutput, error) {
		userID := getUserID(ctx)

		groupID, groupName, err := repo.Invites().Accept(ctx, input.InviteID, userID)
		if err == repository.ErrNotFound {
			return nil, huma.Error404NotFound("invite not found or expired")
		}
		if err == repository.ErrExpired {
			return nil, huma.Error410Gone("invite expired or max uses reached")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to accept invite", err)
		}

		resp := &AcceptInviteOutput{}
		resp.Body.GroupID = groupID
		resp.Body.GroupName = groupName
		return resp, nil
	})
}
