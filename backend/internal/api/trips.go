package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

// --- Input/Output types ---

type CreateTripInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	Body    struct {
		Name        string  `json:"name" minLength:"1" doc:"Trip name"`
		Description *string `json:"description,omitempty" doc:"Optional description"`
		TripDate    *string `json:"tripDate,omitempty" doc:"Date of trip (YYYY-MM-DD)"`
	}
}

type TripOutput struct {
	Body model.Trip
}

type ListTripsOutput struct {
	Body []repository.TripWithTotal
}

type TripPathParams struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	TripID  string `path:"tripID" doc:"Trip ID"`
}

type UpdateTripInput struct {
	GroupID string `path:"groupID" doc:"Group ID"`
	TripID  string `path:"tripID" doc:"Trip ID"`
	Body    struct {
		Name        string  `json:"name" minLength:"1" doc:"Trip name"`
		Description *string `json:"description,omitempty" doc:"Optional description"`
		TripDate    *string `json:"tripDate,omitempty" doc:"Date of trip (YYYY-MM-DD)"`
	}
}

// --- Route registration ---

func registerTripRoutes(api huma.API, repo repository.Repository, member humaMW, admin humaMW) {
	huma.Register(api, huma.Operation{
		OperationID:  "create-trip",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/trips",
		Summary:      "Create a trip/event in a group",
		Tags:         []string{"Trips"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *CreateTripInput) (*TripOutput, error) {
		userID := getUserID(ctx)

		trip, err := repo.Trips().Create(ctx, repository.CreateTripParams{
			GroupID:     input.GroupID,
			Name:        input.Body.Name,
			Description: input.Body.Description,
			TripDate:    input.Body.TripDate,
			CreatedBy:   userID,
		})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create trip", err)
		}
		return &TripOutput{Body: trip}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "list-trips",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}/trips",
		Summary:      "List all trips in a group",
		Tags:         []string{"Trips"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *GroupPathParams) (*ListTripsOutput, error) {
		trips, err := repo.Trips().List(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list trips", err)
		}
		return &ListTripsOutput{Body: trips}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "get-trip",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}/trips/{tripID}",
		Summary:      "Get a trip with its purchases",
		Tags:         []string{"Trips"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *TripPathParams) (*TripOutput, error) {
		trip, err := repo.Trips().Get(ctx, input.GroupID, input.TripID)
		if err != nil {
			return nil, huma.Error404NotFound("trip not found")
		}
		return &TripOutput{Body: trip}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "update-trip",
		Method:       http.MethodPut,
		Path:         "/groups/{groupID}/trips/{tripID}",
		Summary:      "Update a trip",
		Tags:         []string{"Trips"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *UpdateTripInput) (*TripOutput, error) {
		trip, err := repo.Trips().Update(ctx, input.GroupID, input.TripID, repository.UpdateTripParams{
			Name:        input.Body.Name,
			Description: input.Body.Description,
			TripDate:    input.Body.TripDate,
		})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update trip", err)
		}
		return &TripOutput{Body: trip}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "delete-trip",
		Method:       http.MethodDelete,
		Path:         "/groups/{groupID}/trips/{tripID}",
		Summary:      "Delete a trip (purchases become unassigned)",
		Tags:         []string{"Trips"},
		Middlewares:  huma.Middlewares{admin},
	}, func(ctx context.Context, input *TripPathParams) (*StatusOutput, error) {
		err := repo.Trips().Delete(ctx, input.GroupID, input.TripID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete trip", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "deleted"
		return resp, nil
	})
}
