package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
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

type DeleteCategoryInput struct {
	GroupID    string `path:"groupID" doc:"Group ID"`
	CategoryID string `path:"categoryID" doc:"Category ID"`
}

type ListCategoriesOutput struct {
	Body []model.Category
}

// --- Route registration ---

func registerCategoryRoutes(api huma.API, repo repository.Repository, member humaMW) {
	huma.Register(api, huma.Operation{
		OperationID:  "create-category",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/categories",
		Summary:      "Create a category",
		Tags:         []string{"Categories"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *CreateCategoryInput) (*CreateCategoryOutput, error) {
		id, err := repo.Categories().Create(ctx, input.GroupID, input.Body.Name)
		if err != nil {
			return nil, huma.Error409Conflict("category already exists")
		}
		resp := &CreateCategoryOutput{}
		resp.Body.ID = id
		return resp, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "list-categories",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}/categories",
		Summary:      "List categories for a group",
		Tags:         []string{"Categories"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *GroupPathParams) (*ListCategoriesOutput, error) {
		categories, err := repo.Categories().List(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list categories", err)
		}
		return &ListCategoriesOutput{Body: categories}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "delete-category",
		Method:       http.MethodDelete,
		Path:         "/groups/{groupID}/categories/{categoryID}",
		Summary:      "Delete a category",
		Tags:         []string{"Categories"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *DeleteCategoryInput) (*StatusOutput, error) {
		err := repo.Categories().Delete(ctx, input.GroupID, input.CategoryID)
		if err == repository.ErrNotFound {
			return nil, huma.Error404NotFound("category not found")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete category", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "deleted"
		return resp, nil
	})
}
