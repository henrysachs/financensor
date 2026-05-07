package repository

import (
	"context"
	"time"
)

// Invite represents a stored invite row.
type Invite struct {
	ID        string  `json:"id" db:"id"`
	GroupID   string  `json:"groupId" db:"group_id"`
	CreatedBy string  `json:"createdBy" db:"created_by"`
	MaxUses   *int    `json:"maxUses,omitempty" db:"max_uses"`
	UseCount  int     `json:"useCount" db:"use_count"`
	ExpiresAt *string `json:"expiresAt,omitempty" db:"expires_at"`
	CreatedAt string  `json:"createdAt" db:"created_at"`
}

// CreateInviteParams holds the data needed to create an invite.
type CreateInviteParams struct {
	GroupID   string
	CreatedBy string
	MaxUses   *int
	ExpiresAt *time.Time
}

// InviteRepository manages invite persistence.
type InviteRepository interface {
	Create(ctx context.Context, p CreateInviteParams) (Invite, error)
	List(ctx context.Context, groupID string) ([]Invite, error)
	Delete(ctx context.Context, groupID, inviteID string) error
	// Accept validates and accepts an invite, returning the group ID and name.
	// Returns ErrNotFound if invite doesn't exist, ErrExpired if expired/maxed out.
	Accept(ctx context.Context, inviteID, userID string) (groupID, groupName string, err error)
}
