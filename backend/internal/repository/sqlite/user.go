package sqlite

import (
	"context"

	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

type userRepo struct {
	db db
}

func (r *userRepo) GetByID(ctx context.Context, userID string) (model.User, error) {
	var user model.User
	err := r.db.GetContext(ctx, &user,
		"SELECT id, name, email, avatar_url, is_ghost, created_at FROM users WHERE id = ?", userID,
	)
	if err != nil {
		return model.User{}, repository.ErrNotFound
	}
	return user, nil
}

func (r *userRepo) UpsertByGoogleID(ctx context.Context, p repository.UpsertUserParams) (string, bool, error) {
	var userID string
	err := r.db.GetContext(ctx, &userID, "SELECT id FROM users WHERE google_id = ?", p.GoogleID)
	if err == nil {
		// Existing user
		return userID, false, nil
	}

	// Create new user
	userID = uuid.New().String()
	_, err = r.db.ExecContext(ctx,
		"INSERT INTO users (id, name, email, google_id, avatar_url, is_ghost) VALUES (?, ?, ?, ?, ?, 0)",
		userID, p.Name, p.Email, p.GoogleID, p.AvatarURL,
	)
	if err != nil {
		return "", false, err
	}
	return userID, true, nil
}

func (r *userRepo) CreateGhost(ctx context.Context, name string) (string, error) {
	id := uuid.New().String()
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO users (id, name, is_ghost) VALUES (?, ?, 1)",
		id, name,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (r *userRepo) ClaimGhost(ctx context.Context, ghostID, claimerID string) error {
	// Verify ghost exists and is actually a ghost
	var isGhost bool
	err := r.db.GetContext(ctx, &isGhost, "SELECT is_ghost FROM users WHERE id = ?", ghostID)
	if err != nil {
		return repository.ErrNotFound
	}
	if !isGhost {
		return repository.ErrConflict
	}

	// Transfer all references
	if _, err := r.db.ExecContext(ctx, "UPDATE group_members SET user_id = ? WHERE user_id = ?", claimerID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE purchases SET paid_by_user_id = ? WHERE paid_by_user_id = ?", claimerID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE purchases SET created_by = ? WHERE created_by = ?", claimerID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE assignments SET user_id = ? WHERE user_id = ?", claimerID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE settlements SET from_user_id = ? WHERE from_user_id = ?", claimerID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE settlements SET to_user_id = ? WHERE to_user_id = ?", claimerID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "DELETE FROM users WHERE id = ?", ghostID); err != nil {
		return err
	}
	return nil
}

func (r *userRepo) MergeGhost(ctx context.Context, groupID, ghostID, targetID string) error {
	// Verify ghost exists and is actually a ghost
	var isGhost bool
	err := r.db.GetContext(ctx, &isGhost, "SELECT is_ghost FROM users WHERE id = ?", ghostID)
	if err != nil {
		return repository.ErrNotFound
	}
	if !isGhost {
		return repository.ErrConflict
	}

	// Verify target exists
	var targetExists bool
	err = r.db.GetContext(ctx, &targetExists, "SELECT EXISTS(SELECT 1 FROM users WHERE id = ?)", targetID)
	if err != nil || !targetExists {
		return repository.ErrNotFound
	}

	// Transfer all references from ghost to target
	if _, err := r.db.ExecContext(ctx, "UPDATE purchases SET paid_by_user_id = ? WHERE paid_by_user_id = ?", targetID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE purchases SET created_by = ? WHERE created_by = ?", targetID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE assignments SET user_id = ? WHERE user_id = ?", targetID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE settlements SET from_user_id = ? WHERE from_user_id = ?", targetID, ghostID); err != nil {
		return err
	}
	if _, err := r.db.ExecContext(ctx, "UPDATE settlements SET to_user_id = ? WHERE to_user_id = ?", targetID, ghostID); err != nil {
		return err
	}
	// Remove ghost from group_members
	if _, err := r.db.ExecContext(ctx, "DELETE FROM group_members WHERE user_id = ? AND group_id = ?", ghostID, groupID); err != nil {
		return err
	}
	// Delete ghost user
	if _, err := r.db.ExecContext(ctx, "DELETE FROM users WHERE id = ?", ghostID); err != nil {
		return err
	}
	return nil
}
