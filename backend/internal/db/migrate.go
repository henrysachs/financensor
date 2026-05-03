package db

import (
	"fmt"

	"github.com/jmoiron/sqlx"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    is_ghost INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    nickname TEXT,
    role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(group_id, name)
);

CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_by_user_id TEXT NOT NULL REFERENCES users(id),
    category_id TEXT REFERENCES categories(id),
    receipt_url TEXT,
    purchased_at DATE NOT NULL DEFAULT (date('now')),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    custom_share_cents INTEGER,
    UNIQUE(purchase_id, user_id)
);

CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    is_paid INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_purchases_group ON purchases(group_id);
CREATE INDEX IF NOT EXISTS idx_assignments_purchase ON assignments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL REFERENCES users(id),
    expires_at DATETIME,
    max_uses INTEGER,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invites_group ON invites(group_id);

CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trip_date DATE NOT NULL DEFAULT (date('now')),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trips_group ON trips(group_id);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    acting_as_user_id TEXT NOT NULL REFERENCES users(id),
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    last_used_at DATETIME,
    revoked_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_group ON api_keys(group_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(token_hash);
`

func Migrate(db *sqlx.DB) error {
	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	// Incremental migrations for existing DBs
	db.Exec("ALTER TABLE purchases ADD COLUMN purchased_at DATE NOT NULL DEFAULT (date('now'))")
	db.Exec("ALTER TABLE purchases ADD COLUMN trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL")
	db.Exec("ALTER TABLE group_members ADD COLUMN nickname TEXT")

	return nil
}
