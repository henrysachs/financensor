package repository

import (
	"context"

	"github.com/henrysachs/financensor/backend/internal/model"
)

// MemberWithUser is a group member joined with user profile data.
type MemberWithUser struct {
	ID           string  `json:"id" db:"id"`
	Name         string  `json:"name" db:"name"`
	OriginalName string  `json:"originalName" db:"original_name"`
	Nickname     *string `json:"nickname,omitempty" db:"nickname"`
	Email        *string `json:"email,omitempty" db:"email"`
	AvatarURL    *string `json:"avatarUrl,omitempty" db:"avatar_url"`
	IsGhost      bool    `json:"isGhost" db:"is_ghost"`
	Role         string  `json:"role" db:"role"`
}

// GroupRepository manages group persistence and membership queries.
type GroupRepository interface {
	Create(ctx context.Context, name, createdBy string) (string, error)
	List(ctx context.Context, userID string) ([]model.Group, error)
	Get(ctx context.Context, groupID string) (model.Group, error)
	Update(ctx context.Context, groupID, name string) error
	Delete(ctx context.Context, groupID string) error

	ListMembers(ctx context.Context, groupID string) ([]MemberWithUser, error)
	AddMember(ctx context.Context, groupID, userID string, role model.Role) error
	RemoveMember(ctx context.Context, groupID, userID string) error
	UpdateNickname(ctx context.Context, groupID, userID, nickname string) error

	IsMember(ctx context.Context, groupID, userID string) (bool, error)
	IsAdmin(ctx context.Context, groupID, userID string) (bool, error)
}
