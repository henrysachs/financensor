package sqlite

import (
	"context"

	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

type groupRepo struct {
	db db
}

func (r *groupRepo) Create(ctx context.Context, name, createdBy string) (string, error) {
	id := uuid.New().String()
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)",
		id, name, createdBy,
	)
	if err != nil {
		return "", err
	}

	// Add creator as admin
	_, err = r.db.ExecContext(ctx,
		"INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
		id, createdBy, model.RoleAdmin,
	)
	if err != nil {
		return "", err
	}

	return id, nil
}

func (r *groupRepo) List(ctx context.Context, userID string) ([]model.Group, error) {
	var groups []model.Group
	err := r.db.SelectContext(ctx, &groups, `
		SELECT g.id, g.name, g.created_by, g.created_at
		FROM groups g
		JOIN group_members gm ON g.id = gm.group_id
		WHERE gm.user_id = ?
		ORDER BY g.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	if groups == nil {
		groups = []model.Group{}
	}
	return groups, nil
}

func (r *groupRepo) Get(ctx context.Context, groupID string) (model.Group, error) {
	var group model.Group
	err := r.db.GetContext(ctx, &group, "SELECT id, name, created_by, created_at FROM groups WHERE id = ?", groupID)
	if err != nil {
		return model.Group{}, repository.ErrNotFound
	}
	return group, nil
}

func (r *groupRepo) Update(ctx context.Context, groupID, name string) error {
	_, err := r.db.ExecContext(ctx, "UPDATE groups SET name = ? WHERE id = ?", name, groupID)
	return err
}

func (r *groupRepo) Delete(ctx context.Context, groupID string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM groups WHERE id = ?", groupID)
	return err
}

func (r *groupRepo) ListMembers(ctx context.Context, groupID string) ([]repository.MemberWithUser, error) {
	var members []repository.MemberWithUser
	err := r.db.SelectContext(ctx, &members, `
		SELECT u.id,
		       COALESCE(NULLIF(gm.nickname, ''), u.name) AS name,
		       u.name AS original_name,
		       gm.nickname,
		       u.email,
		       u.avatar_url,
		       u.is_ghost,
		       gm.role
		FROM users u
		JOIN group_members gm ON u.id = gm.user_id
		WHERE gm.group_id = ?
		ORDER BY gm.role ASC, COALESCE(NULLIF(gm.nickname, ''), u.name) ASC
	`, groupID)
	if err != nil {
		return nil, err
	}
	if members == nil {
		members = []repository.MemberWithUser{}
	}
	return members, nil
}

func (r *groupRepo) AddMember(ctx context.Context, groupID, userID string, role model.Role) error {
	_, err := r.db.ExecContext(ctx,
		"INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)",
		groupID, userID, role,
	)
	return err
}

func (r *groupRepo) RemoveMember(ctx context.Context, groupID, userID string) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, userID,
	)
	return err
}

func (r *groupRepo) UpdateNickname(ctx context.Context, groupID, userID, nickname string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE group_members SET nickname = NULLIF(?, '') WHERE group_id = ? AND user_id = ?",
		nickname, groupID, userID,
	)
	return err
}

func (r *groupRepo) IsMember(ctx context.Context, groupID, userID string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		"SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, userID,
	)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *groupRepo) IsAdmin(ctx context.Context, groupID, userID string) (bool, error) {
	var role string
	err := r.db.GetContext(ctx, &role,
		"SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
		groupID, userID,
	)
	if err != nil {
		return false, nil
	}
	return role == string(model.RoleAdmin), nil
}
