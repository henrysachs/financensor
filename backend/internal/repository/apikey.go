package repository

import (
	"context"
	"time"
)

// APIKeyRow represents a stored API key (without the raw token).
type APIKeyRow struct {
	ID              string     `json:"id" db:"id"`
	GroupID         string     `json:"groupId" db:"group_id"`
	Label           string     `json:"label" db:"label"`
	ActingAsUserID  string     `json:"actingAsUserId" db:"acting_as_user_id"`
	CreatedByUserID string     `json:"createdByUserId" db:"created_by_user_id"`
	LastUsedAt      *time.Time `json:"lastUsedAt,omitempty" db:"last_used_at"`
	RevokedAt       *time.Time `json:"revokedAt,omitempty" db:"revoked_at"`
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
}

// CreateAPIKeyParams holds the data needed to create an API key.
type CreateAPIKeyParams struct {
	GroupID         string
	Label           string
	TokenHash       string
	ActingAsUserID  string
	CreatedByUserID string
}

// APIKeyAuth holds the data needed to authenticate via API key.
type APIKeyAuth struct {
	ID             string     `db:"id"`
	GroupID        string     `db:"group_id"`
	ActingAsUserID string     `db:"acting_as_user_id"`
	RevokedAt      *time.Time `db:"revoked_at"`
}

// APIKeyRepository manages API key persistence.
type APIKeyRepository interface {
	Create(ctx context.Context, p CreateAPIKeyParams) (string, error)
	List(ctx context.Context, groupID string) ([]APIKeyRow, error)
	Revoke(ctx context.Context, groupID, keyID string) error
	// GetByTokenHash retrieves an API key by its hash for authentication.
	GetByTokenHash(ctx context.Context, tokenHash string) (APIKeyAuth, error)
	// TouchLastUsed updates the last_used_at timestamp.
	TouchLastUsed(ctx context.Context, keyID string) error
}
