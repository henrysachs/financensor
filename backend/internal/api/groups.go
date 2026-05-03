package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/jmoiron/sqlx"
)

// --- Input/Output types ---

type GroupPathParams struct {
	GroupID string `path:"groupID" doc:"Group ID"`
}

type CreateGroupInput struct {
	Body struct {
		Name string `json:"name" minLength:"1" doc:"Group name"`
	}
}

type CreateGroupOutput struct {
	Body struct {
		ID string `json:"id" doc:"Created group ID"`
	}
}

type ListGroupsOutput struct {
	Body []model.Group
}

type GetGroupOutput struct {
	Body model.Group
}

type UpdateGroupInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		Name string `json:"name" minLength:"1" doc:"New group name"`
	}
}

type StatusOutput struct {
	Body struct {
		Status string `json:"status"`
	}
}

type AddMemberInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		UserID string `json:"userId" minLength:"1" doc:"User ID to add"`
	}
}

type RemoveMemberInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	UserID  string `path:"userID" doc:"User ID to remove"`
}

type MemberResponse struct {
	ID        string  `json:"id" db:"id"`
	Name      string  `json:"name" db:"name"`
	Email     *string `json:"email,omitempty" db:"email"`
	AvatarURL *string `json:"avatarUrl,omitempty" db:"avatar_url"`
	IsGhost   bool    `json:"isGhost" db:"is_ghost"`
	Role      string  `json:"role" db:"role"`
}

type ListMembersOutput struct {
	Body []MemberResponse
}

// --- Route registration ---

func registerGroupRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "create-group",
		Method:      http.MethodPost,
		Path:        "/groups",
		Summary:     "Create a group",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *CreateGroupInput) (*CreateGroupOutput, error) {
		userID := auth.GetUserID(ctx)

		groupID := uuid.New().String()
		tx, err := db.Beginx()
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to begin transaction", err)
		}
		defer tx.Rollback()

		_, err = tx.Exec(
			"INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)",
			groupID, input.Body.Name, userID,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create group", err)
		}

		_, err = tx.Exec(
			"INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
			groupID, userID, model.RoleAdmin,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to add admin member", err)
		}

		if err := tx.Commit(); err != nil {
			return nil, huma.Error500InternalServerError("failed to commit", err)
		}

		resp := &CreateGroupOutput{}
		resp.Body.ID = groupID
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-groups",
		Method:      http.MethodGet,
		Path:        "/groups",
		Summary:     "List groups for current user",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *struct{}) (*ListGroupsOutput, error) {
		userID := auth.GetUserID(ctx)

		var groups []model.Group
		err := db.Select(&groups, `
			SELECT g.id, g.name, g.created_by, g.created_at
			FROM groups g
			JOIN group_members gm ON g.id = gm.group_id
			WHERE gm.user_id = ?
			ORDER BY g.created_at DESC
		`, userID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list groups", err)
		}

		if groups == nil {
			groups = []model.Group{}
		}

		return &ListGroupsOutput{Body: groups}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-group",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}",
		Summary:     "Get group details",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *GroupPathParams) (*GetGroupOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member of this group")
		}

		var group model.Group
		err := db.Get(&group, "SELECT id, name, created_by, created_at FROM groups WHERE id = ?", input.GroupID)
		if err != nil {
			return nil, huma.Error404NotFound("group not found")
		}

		return &GetGroupOutput{Body: group}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-group",
		Method:      http.MethodPut,
		Path:        "/groups/{groupID}",
		Summary:     "Update group name",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *UpdateGroupInput) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		_, err := db.Exec("UPDATE groups SET name = ? WHERE id = ?", input.Body.Name, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update group", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "updated"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-group",
		Method:      http.MethodDelete,
		Path:        "/groups/{groupID}",
		Summary:     "Delete a group",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *GroupPathParams) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		_, err := db.Exec("DELETE FROM groups WHERE id = ?", input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete group", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "deleted"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-members",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}/members",
		Summary:     "List group members",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *GroupPathParams) (*ListMembersOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		var members []MemberResponse
		err := db.Select(&members, `
			SELECT u.id, u.name, u.email, u.avatar_url, u.is_ghost, gm.role
			FROM users u
			JOIN group_members gm ON u.id = gm.user_id
			WHERE gm.group_id = ?
			ORDER BY gm.role ASC, u.name ASC
		`, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError(fmt.Sprintf("failed to list members: %v", err))
		}

		if members == nil {
			members = []MemberResponse{}
		}

		return &ListMembersOutput{Body: members}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "add-member",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/members",
		Summary:     "Add a member to group",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *AddMemberInput) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		_, err := db.Exec(
			"INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
			input.GroupID, input.Body.UserID, model.RoleMember,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to add member", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "added"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "remove-member",
		Method:      http.MethodDelete,
		Path:        "/groups/{groupID}/members/{userID}",
		Summary:     "Remove a member from group",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *RemoveMemberInput) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		if input.UserID == userID {
			return nil, huma.Error400BadRequest("cannot remove yourself")
		}

		_, err := db.Exec(
			"DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
			input.GroupID, input.UserID,
		)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to remove member", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "removed"
		return resp, nil
	})
}

func isMember(db *sqlx.DB, groupID, userID string) bool {
	var count int
	err := db.Get(&count, "SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?", groupID, userID)
	return err == nil && count > 0
}

func isAdmin(db *sqlx.DB, groupID, userID string) bool {
	var role string
	err := db.Get(&role, "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?", groupID, userID)
	return err == nil && role == string(model.RoleAdmin)
}
