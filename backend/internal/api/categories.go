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

type CreateCategoryInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		Name string `json:"name" minLength:"1" doc:"Category name"`
	}
}

type CreateCategoryOutput struct {
	Body struct {
		ID string `json:"id" doc:"Created category ID"`
	}
}

type ListCategoriesOutput struct {
	Body []model.Category
}

// --- Route registration ---

func registerCategoryRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "create-category",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/categories",
		Summary:     "Create a category",
		Tags:        []string{"Categories"},
	}, func(ctx context.Context, input *CreateCategoryInput) (*CreateCategoryOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		id := uuid.New().String()
		_, err := db.Exec("INSERT INTO categories (id, group_id, name) VALUES (?, ?, ?)", id, input.GroupID, input.Body.Name)
		if err != nil {
			return nil, huma.Error409Conflict("category already exists")
		}

		resp := &CreateCategoryOutput{}
		resp.Body.ID = id
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-categories",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}/categories",
		Summary:     "List categories for a group",
		Tags:        []string{"Categories"},
	}, func(ctx context.Context, input *GroupPathParams) (*ListCategoriesOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		var categories []model.Category
		err := db.Select(&categories, "SELECT id, group_id, name FROM categories WHERE group_id = ?", input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list categories", err)
		}

		if categories == nil {
			categories = []model.Category{}
		}

		return &ListCategoriesOutput{Body: categories}, nil
	})
}
