package repository

import (
	"context"

	"github.com/henrysachs/financensor/backend/internal/model"
)

// UpsertUserParams holds the data for creating or updating a user via OAuth.
type UpsertUserParams struct {
	Name      string
	Email     string
	GoogleID  string
	AvatarURL string
}

// UserRepository manages user persistence.
type UserRepository interface {
	GetByID(ctx context.Context, userID string) (model.User, error)
	// UpsertByGoogleID finds a user by Google ID or creates one. Returns the user ID.
	UpsertByGoogleID(ctx context.Context, p UpsertUserParams) (string, bool, error)
	CreateGhost(ctx context.Context, name string) (string, error)
	// ClaimGhost merges a ghost user into the claimer, transferring all references.
	ClaimGhost(ctx context.Context, ghostID, claimerID string) error
	// MergeGhost merges a ghost user into a target user within a specific group.
	MergeGhost(ctx context.Context, groupID, ghostID, targetID string) error
}
