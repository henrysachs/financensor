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
	Body []tripWithTotal
}

type tripWithTotal struct {
	model.Trip
	TotalCents    int64 `db:"total_cents" json:"totalCents"`
	PurchaseCount int   `db:"purchase_count" json:"purchaseCount"`
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

func registerTripRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "create-trip",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/trips",
		Summary:     "Create a trip/event in a group",
		Tags:        []string{"Trips"},
	}, func(ctx context.Context, input *CreateTripInput) (*TripOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		id := uuid.New().String()
		tripDate := "date('now')"
		args := []any{id, input.GroupID, input.Body.Name, input.Body.Description}
		if input.Body.TripDate != nil && *input.Body.TripDate != "" {
			tripDate = "?"
			args = append(args, *input.Body.TripDate)
		}
		args = append(args, userID)

		_, err := db.Exec(`
			INSERT INTO trips (id, group_id, name, description, trip_date, created_by)
			VALUES (?, ?, ?, ?, `+tripDate+`, ?)
		`, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to create trip", err)
		}

		var trip model.Trip
		db.Get(&trip, "SELECT * FROM trips WHERE id = ?", id)

		return &TripOutput{Body: trip}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "list-trips",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}/trips",
		Summary:     "List all trips in a group",
		Tags:        []string{"Trips"},
	}, func(ctx context.Context, input *GroupPathParams) (*ListTripsOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		var trips []tripWithTotal
		err := db.Select(&trips, `
			SELECT t.*,
				COALESCE(SUM(p.amount_cents), 0) as total_cents,
				COUNT(p.id) as purchase_count
			FROM trips t
			LEFT JOIN purchases p ON p.trip_id = t.id
			WHERE t.group_id = ?
			GROUP BY t.id
			ORDER BY t.trip_date DESC, t.created_at DESC
		`, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list trips", err)
		}

		if trips == nil {
			trips = []tripWithTotal{}
		}

		return &ListTripsOutput{Body: trips}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "get-trip",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}/trips/{tripID}",
		Summary:     "Get a trip with its purchases",
		Tags:        []string{"Trips"},
	}, func(ctx context.Context, input *TripPathParams) (*TripOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		var trip model.Trip
		err := db.Get(&trip, "SELECT * FROM trips WHERE id = ? AND group_id = ?", input.TripID, input.GroupID)
		if err != nil {
			return nil, huma.Error404NotFound("trip not found")
		}

		return &TripOutput{Body: trip}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "update-trip",
		Method:      http.MethodPut,
		Path:        "/groups/{groupID}/trips/{tripID}",
		Summary:     "Update a trip",
		Tags:        []string{"Trips"},
	}, func(ctx context.Context, input *UpdateTripInput) (*TripOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		_, err := db.Exec(`
			UPDATE trips SET name = ?, description = ?, trip_date = COALESCE(?, trip_date)
			WHERE id = ? AND group_id = ?
		`, input.Body.Name, input.Body.Description, input.Body.TripDate, input.TripID, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update trip", err)
		}

		var trip model.Trip
		db.Get(&trip, "SELECT * FROM trips WHERE id = ?", input.TripID)

		return &TripOutput{Body: trip}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "delete-trip",
		Method:      http.MethodDelete,
		Path:        "/groups/{groupID}/trips/{tripID}",
		Summary:     "Delete a trip (purchases become unassigned)",
		Tags:        []string{"Trips"},
	}, func(ctx context.Context, input *TripPathParams) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isAdmin(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("admin only")
		}

		_, err := db.Exec("DELETE FROM trips WHERE id = ? AND group_id = ?", input.TripID, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to delete trip", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "deleted"
		return resp, nil
	})
}
