#!/bin/sh
set -eu

DB_PATH="/data/financensor.db"
BACKUP_DIR="/tmp/backups"
MAX_BACKUPS=3
BUCKET="financensor"
PREFIX="backups"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/financensor-$TIMESTAMP.db"

# Safe SQLite backup (consistent snapshot)
sqlite3 "$DB_PATH" "VACUUM INTO '$BACKUP_FILE';"
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

echo "[backup] Created $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Upload to R2
mc cp "$BACKUP_FILE" "r2/$BUCKET/$PREFIX/financensor-$TIMESTAMP.db.gz"
echo "[backup] Uploaded to r2/$BUCKET/$PREFIX/financensor-$TIMESTAMP.db.gz"

# Rotate: keep only MAX_BACKUPS
OBJECTS=$(mc ls "r2/$BUCKET/$PREFIX/" --json 2>/dev/null | grep -o '"key":"[^"]*"' | sed 's/"key":"//;s/"//' | sort)
COUNT=$(echo "$OBJECTS" | grep -c . || true)

if [ "$COUNT" -gt "$MAX_BACKUPS" ]; then
  DELETE_COUNT=$((COUNT - MAX_BACKUPS))
  echo "$OBJECTS" | head -n "$DELETE_COUNT" | while read -r key; do
    mc rm "r2/$BUCKET/$PREFIX/$key"
    echo "[backup] Deleted old: $key"
  done
fi

rm -f "$BACKUP_FILE"
echo "[backup] Done"
