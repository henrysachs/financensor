#!/bin/bash
set -euo pipefail

SERVER="hetzner"
REMOTE_DIR="/opt/financensor"

echo "==> Syncing project to server..."
rsync -avz --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='*.db' \
  -e "ssh -i ~/.ssh/hetzner_ed25519" \
  ./ root@116.203.26.33:${REMOTE_DIR}/

echo "==> Copying production env..."
scp -i ~/.ssh/hetzner_ed25519 .env.production root@116.203.26.33:${REMOTE_DIR}/.env

echo "==> Building and starting containers on server..."
ssh ${SERVER} "cd ${REMOTE_DIR} && docker compose --env-file .env up --build -d"

echo "==> Done! App running at http://116.203.26.33"
