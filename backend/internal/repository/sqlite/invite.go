package sqlite

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

type inviteRepo struct {
	db db
}

func (r *inviteRepo) Create(ctx context.Context, p repository.CreateInviteParams) (repository.Invite, error) {
	id := uuid.New().String()
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO invites (id, group_id, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)",
		id, p.GroupID, p.CreatedBy, p.ExpiresAt, p.MaxUses,
	)
	if err != nil {
		return repository.Invite{}, err
	}

	invite := repository.Invite{
		ID:        id,
		GroupID:   p.GroupID,
		CreatedBy: p.CreatedBy,
		MaxUses:   p.MaxUses,
		UseCount:  0,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	if p.ExpiresAt != nil {
		s := p.ExpiresAt.Format(time.RFC3339)
		invite.ExpiresAt = &s
	}
	return invite, nil
}

func (r *inviteRepo) List(ctx context.Context, groupID string) ([]repository.Invite, error) {
	var invites []repository.Invite
	err := r.db.SelectContext(ctx, &invites, `
		SELECT id, group_id, created_by, max_uses, use_count, expires_at, created_at
		FROM invites WHERE group_id = ?
		ORDER BY created_at DESC
	`, groupID)
	if err != nil {
		return nil, err
	}
	if invites == nil {
		invites = []repository.Invite{}
	}
	return invites, nil
}

func (r *inviteRepo) Delete(ctx context.Context, groupID, inviteID string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM invites WHERE id = ? AND group_id = ?", inviteID, groupID,
	)
	return err
}

func (r *inviteRepo) Accept(ctx context.Context, inviteID, userID string) (string, string, error) {
	var invite struct {
		ID        string  `db:"id"`
		GroupID   string  `db:"group_id"`
		MaxUses   *int    `db:"max_uses"`
		UseCount  int     `db:"use_count"`
		ExpiresAt *string `db:"expires_at"`
	}
	err := r.db.GetContext(ctx, &invite,
		"SELECT id, group_id, max_uses, use_count, expires_at FROM invites WHERE id = ?", inviteID,
	)
	if err != nil {
		return "", "", repository.ErrNotFound
	}

	// Check expiry
	if invite.ExpiresAt != nil {
		exp, _ := time.Parse("2006-01-02 15:04:05", *invite.ExpiresAt)
		if time.Now().After(exp) {
			return "", "", repository.ErrExpired
		}
	}

	// Check max uses
	if invite.MaxUses != nil && invite.UseCount >= *invite.MaxUses {
		return "", "", repository.ErrExpired
	}

	// Check if already a member
	var memberCount int
	r.db.GetContext(ctx, &memberCount,
		"SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		invite.GroupID, userID,
	)

	if memberCount == 0 {
		// Add as member
		_, err = r.db.ExecContext(ctx,
			"INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
			invite.GroupID, userID, model.RoleMember,
		)
		if err != nil {
			return "", "", err
		}

		// Increment use count
		r.db.ExecContext(ctx, "UPDATE invites SET use_count = use_count + 1 WHERE id = ?", invite.ID) //nolint:errcheck
	}

	var group model.Group
	err = r.db.GetContext(ctx, &group, "SELECT id, name FROM groups WHERE id = ?", invite.GroupID)
	if err != nil {
		return "", "", err
	}

	return invite.GroupID, group.Name, nil
}
