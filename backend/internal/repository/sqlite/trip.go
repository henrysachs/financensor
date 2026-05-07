package sqlite

import (
	"context"

	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

type tripRepo struct {
	db db
}

func (r *tripRepo) Create(ctx context.Context, p repository.CreateTripParams) (model.Trip, error) {
	id := uuid.New().String()

	tripDate := "date('now')"
	args := []any{id, p.GroupID, p.Name, p.Description}
	if p.TripDate != nil && *p.TripDate != "" {
		tripDate = "?"
		args = append(args, *p.TripDate)
	}
	args = append(args, p.CreatedBy)

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO trips (id, group_id, name, description, trip_date, created_by)
		VALUES (?, ?, ?, ?, `+tripDate+`, ?)
	`, args...)
	if err != nil {
		return model.Trip{}, err
	}

	var trip model.Trip
	err = r.db.GetContext(ctx, &trip, "SELECT * FROM trips WHERE id = ?", id)
	if err != nil {
		return model.Trip{}, err
	}
	return trip, nil
}

func (r *tripRepo) List(ctx context.Context, groupID string) ([]repository.TripWithTotal, error) {
	var trips []repository.TripWithTotal
	err := r.db.SelectContext(ctx, &trips, `
		SELECT t.*,
			COALESCE(SUM(p.amount_cents), 0) as total_cents,
			COUNT(p.id) as purchase_count
		FROM trips t
		LEFT JOIN purchases p ON p.trip_id = t.id
		WHERE t.group_id = ?
		GROUP BY t.id
		ORDER BY t.trip_date DESC, t.created_at DESC
	`, groupID)
	if err != nil {
		return nil, err
	}
	if trips == nil {
		trips = []repository.TripWithTotal{}
	}
	return trips, nil
}

func (r *tripRepo) Get(ctx context.Context, groupID, tripID string) (model.Trip, error) {
	var trip model.Trip
	err := r.db.GetContext(ctx, &trip,
		"SELECT * FROM trips WHERE id = ? AND group_id = ?", tripID, groupID,
	)
	if err != nil {
		return model.Trip{}, repository.ErrNotFound
	}
	return trip, nil
}

func (r *tripRepo) Update(ctx context.Context, groupID, tripID string, p repository.UpdateTripParams) (model.Trip, error) {
	_, err := r.db.ExecContext(ctx, `
		UPDATE trips SET name = ?, description = ?, trip_date = COALESCE(?, trip_date)
		WHERE id = ? AND group_id = ?
	`, p.Name, p.Description, p.TripDate, tripID, groupID)
	if err != nil {
		return model.Trip{}, err
	}

	var trip model.Trip
	err = r.db.GetContext(ctx, &trip, "SELECT * FROM trips WHERE id = ?", tripID)
	if err != nil {
		return model.Trip{}, err
	}
	return trip, nil
}

func (r *tripRepo) Delete(ctx context.Context, groupID, tripID string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM trips WHERE id = ? AND group_id = ?", tripID, groupID,
	)
	return err
}
