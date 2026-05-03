package api

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/jmoiron/sqlx"
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
	Body []inviteRow
}

type inviteRow struct {
	ID        string  `json:"id" db:"id"`
	GroupID   string  `json:"groupId" db:"group_id"`
	CreatedBy string  `json:"createdBy" db:"created_by"`
	MaxUses   *int    `json:"maxUses,omitempty" db:"max_uses"`
	UseCount  int     `json:"useCount" db:"use_count"`
	ExpiresAt *string `json:"expiresAt,omitempty" db:"expires_at"`
	CreatedAt string  `json:"createdAt" db:"created_at"`
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

func registerInviteRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "create-invite",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/invites",
		Summary:     "Create an invite link for a group",
		Tags:        []string{"Invites"},
	}, func(ctx context.Context, input *CreateInviteInput) (*InviteOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		id := uuid.New().String()
		var expiresAt *time.Time
		if input.Body.ExpiresIn != nil {
			t := time.Now().Add(time.Duration(*input.Body.ExpiresIn) * time.Hour)
			expiresAt = &t
		}

		_, err := db.Exec(
			"INSERT INTO invites (id, group_id, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)",
			id, input.GroupID, userID, expiresAt, input.Body.MaxUses,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create invite", err)
		}

		resp := &InviteOutput{}
		resp.Body.ID = id
		resp.Body.GroupID = input.GroupID
		resp.Body.MaxUses = input.Body.MaxUses
		resp.Body.UseCount = 0
		if expiresAt != nil {
			s := expiresAt.Format(time.RFC3339)
			resp.Body.ExpiresAt = &s
		}
		resp.Body.CreatedAt = time.Now().Format(time.RFC3339)
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-invites",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}/invites",
		Summary:     "List active invites for a group",
		Tags:        []string{"Invites"},
	}, func(ctx context.Context, input *GroupPathParams) (*ListInvitesOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		var invites []inviteRow
		err := db.Select(&invites, `
			SELECT id, group_id, created_by, max_uses, use_count, expires_at, created_at
			FROM invites WHERE group_id = ?
			ORDER BY created_at DESC
		`, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list invites", err)
		}

		if invites == nil {
			invites = []inviteRow{}
		}

		return &ListInvitesOutput{Body: invites}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-invite",
		Method:      http.MethodDelete,
		Path:        "/groups/{groupID}/invites/{inviteID}",
		Summary:     "Delete an invite",
		Tags:        []string{"Invites"},
	}, func(ctx context.Context, input *DeleteInviteInput) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		_, err := db.Exec("DELETE FROM invites WHERE id = ? AND group_id = ?", input.InviteID, input.GroupID)
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
		userID := auth.GetUserID(ctx)

		// Fetch invite
		var invite struct {
			ID        string  `db:"id"`
			GroupID   string  `db:"group_id"`
			MaxUses   *int    `db:"max_uses"`
			UseCount  int     `db:"use_count"`
			ExpiresAt *string `db:"expires_at"`
		}
		err := db.Get(&invite, "SELECT id, group_id, max_uses, use_count, expires_at FROM invites WHERE id = ?", input.InviteID)
		if err != nil {
			return nil, huma.Error404NotFound("invite not found or expired")
		}

		// Check expiry
		if invite.ExpiresAt != nil {
			exp, _ := time.Parse("2006-01-02 15:04:05", *invite.ExpiresAt)
			if time.Now().After(exp) {
				return nil, huma.Error410Gone("invite expired")
			}
		}

		// Check max uses
		if invite.MaxUses != nil && invite.UseCount >= *invite.MaxUses {
			return nil, huma.Error410Gone("invite has reached max uses")
		}

		// Check if already a member
		if isMember(db, invite.GroupID, userID) {
			// Already a member, just return the group info
			var group model.Group
			db.Get(&group, "SELECT id, name FROM groups WHERE id = ?", invite.GroupID)
			resp := &AcceptInviteOutput{}
			resp.Body.GroupID = invite.GroupID
			resp.Body.GroupName = group.Name
			return resp, nil
		}

		// Add as member
		_, err = db.Exec(
			"INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
			invite.GroupID, userID, model.RoleMember,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to join group", err)
		}

		// Increment use count
		db.Exec("UPDATE invites SET use_count = use_count + 1 WHERE id = ?", invite.ID)

		var group model.Group
		db.Get(&group, "SELECT id, name FROM groups WHERE id = ?", invite.GroupID)

		resp := &AcceptInviteOutput{}
		resp.Body.GroupID = invite.GroupID
		resp.Body.GroupName = group.Name
		return resp, nil
	})
}
