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

type UpdateMemberNicknameInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	UserID  string `path:"userID" doc:"User ID to update"`
	Body    struct {
		Nickname string `json:"nickname" doc:"Nickname for this group, empty clears it"`
	}
}

type MemberResponse = repository.MemberWithUser

type ListMembersOutput struct {
	Body []MemberResponse
}

// --- Route registration ---

func registerGroupRoutes(api huma.API, repo repository.Repository, member humaMW, admin humaMW) {
	huma.Register(api, huma.Operation{
		OperationID: "create-group",
		Method:      http.MethodPost,
		Path:        "/groups",
		Summary:     "Create a group",
		Tags:        []string{"Groups"},
	}, func(ctx context.Context, input *CreateGroupInput) (*CreateGroupOutput, error) {
		userID := getUserID(ctx)

		var groupID string
		err := repo.WithTx(ctx, func(r repository.Repository) error {
			var txErr error
			groupID, txErr = r.Groups().Create(ctx, input.Body.Name, userID)
			if txErr != nil {
				return txErr
			}
			return r.Categories().CreateDefaults(ctx, groupID)
		})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create group", err)
		}

		metrics.GroupsCreatedTotal.Inc()

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
		userID := getUserID(ctx)

		groups, err := repo.Groups().List(ctx, userID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list groups", err)
		}

		return &ListGroupsOutput{Body: groups}, nil
	})

	// Group-scoped routes below rely on RequireGroupMember/RequireGroupAdmin middleware.

	huma.Register(api, huma.Operation{
		OperationID:  "get-group",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}",
		Summary:      "Get group details",
		Tags:         []string{"Groups"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *GroupPathParams) (*GetGroupOutput, error) {
		group, err := repo.Groups().Get(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error404NotFound("group not found")
		}
		return &GetGroupOutput{Body: group}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "update-group",
		Method:       http.MethodPut,
		Path:         "/groups/{groupID}",
		Summary:      "Update group name",
		Tags:         []string{"Groups"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *UpdateGroupInput) (*StatusOutput, error) {
		err := repo.Groups().Update(ctx, input.GroupID, input.Body.Name)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update group", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "updated"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "delete-group",
		Method:       http.MethodDelete,
		Path:         "/groups/{groupID}",
		Summary:      "Delete a group",
		Tags:         []string{"Groups"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *GroupPathParams) (*StatusOutput, error) {
		err := repo.Groups().Delete(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete group", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "deleted"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "list-members",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}/members",
		Summary:      "List group members",
		Tags:         []string{"Groups"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *GroupPathParams) (*ListMembersOutput, error) {
		members, err := repo.Groups().ListMembers(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list members", err)
		}
		return &ListMembersOutput{Body: members}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "update-member-nickname",
		Method:       http.MethodPut,
		Path:         "/groups/{groupID}/members/{userID}",
		Summary:      "Update nickname for a group member",
		Tags:         []string{"Groups"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *UpdateMemberNicknameInput) (*StatusOutput, error) {
		userID := getUserID(ctx)

		// Self or admin can update nickname
		if userID != input.UserID {
			isAdmin, _ := repo.Groups().IsAdmin(ctx, input.GroupID, userID)
			if !isAdmin {
				return nil, huma.Error403Forbidden("only self or admin")
			}
		}

		isMember, _ := repo.Groups().IsMember(ctx, input.GroupID, input.UserID)
		if !isMember {
			return nil, huma.Error404NotFound("member not found")
		}

		err := repo.Groups().UpdateNickname(ctx, input.GroupID, input.UserID, input.Body.Nickname)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update nickname", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "updated"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "add-member",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/members",
		Summary:      "Add a member to group",
		Tags:         []string{"Groups"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *AddMemberInput) (*StatusOutput, error) {
		err := repo.Groups().AddMember(ctx, input.GroupID, input.Body.UserID, model.RoleMember)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to add member", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "added"
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "remove-member",
		Method:       http.MethodDelete,
		Path:         "/groups/{groupID}/members/{userID}",
		Summary:      "Remove a member from group",
		Tags:         []string{"Groups"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *RemoveMemberInput) (*StatusOutput, error) {
		userID := getUserID(ctx)
		if input.UserID == userID {
			return nil, huma.Error400BadRequest("cannot remove yourself")
		}

		err := repo.Groups().RemoveMember(ctx, input.GroupID, input.UserID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to remove member", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "removed"
		return resp, nil
	})
}
