package sqlite

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

type apiKeyRepo struct {
	db db
}

func (r *apiKeyRepo) Create(ctx context.Context, p repository.CreateAPIKeyParams) (string, error) {
	id := uuid.New().String()
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO api_keys (id, group_id, label, token_hash, acting_as_user_id, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)",
		id, p.GroupID, p.Label, p.TokenHash, p.ActingAsUserID, p.CreatedByUserID,
	)
	if err != nil {
		return "", err
	}
	return id, nil
}

func (r *apiKeyRepo) List(ctx context.Context, groupID string) ([]repository.APIKeyRow, error) {
	var keys []repository.APIKeyRow
	err := r.db.SelectContext(ctx, &keys, `
		SELECT id, group_id, label, acting_as_user_id, created_by_user_id, last_used_at, revoked_at, created_at
		FROM api_keys
		WHERE group_id = ?
		ORDER BY created_at DESC
	`, groupID)
	if err != nil {
		return nil, err
	}
	if keys == nil {
		keys = []repository.APIKeyRow{}
	}
	return keys, nil
}

func (r *apiKeyRepo) Revoke(ctx context.Context, groupID, keyID string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND group_id = ? AND revoked_at IS NULL",
		keyID, groupID,
	)
	return err
}

func (r *apiKeyRepo) GetByTokenHash(ctx context.Context, tokenHash string) (repository.APIKeyAuth, error) {
	var key repository.APIKeyAuth
	err := r.db.GetContext(ctx, &key,
		"SELECT id, group_id, acting_as_user_id, revoked_at FROM api_keys WHERE token_hash = ?", tokenHash,
	)
	if err != nil {
		return repository.APIKeyAuth{}, repository.ErrNotFound
	}
	return key, nil
}

func (r *apiKeyRepo) TouchLastUsed(ctx context.Context, keyID string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE api_keys SET last_used_at = ? WHERE id = ?",
		time.Now().UTC(), keyID,
	)
	return err
}
