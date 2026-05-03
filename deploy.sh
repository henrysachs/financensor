#!/bin/bash
set -euo pipefail

SERVER="hetzner"
REMOTE_DIR="/opt/financensor"
REGISTRY="ghcr.io/henrysachs"
TAG="${1:-latest}"

echo "==> Building images (linux/amd64)..."
docker build --platform linux/amd64 -t ${REGISTRY}/financensor-backend:${TAG} ./backend
docker build --platform linux/amd64 -t ${REGISTRY}/financensor-frontend:${TAG} ./frontend

echo "==> Pushing to ghcr.io..."
docker push ${REGISTRY}/financensor-backend:${TAG}
docker push ${REGISTRY}/financensor-frontend:${TAG}

echo "==> Syncing compose + config to server..."
rsync -avz --include='docker-compose.yml' --include='monitoring/***' --include='scripts/***' \
  --include='.env.production' --exclude='*' \
  -e "ssh -i ~/.ssh/hetzner_ed25519" \
  ./ root@116.203.26.33:${REMOTE_DIR}/

echo "==> Copying production env..."
scp -i ~/.ssh/hetzner_ed25519 .env.production root@116.203.26.33:${REMOTE_DIR}/.env

echo "==> Setting IMAGE_TAG=${TAG} on server..."
ssh ${SERVER} "grep -v '^IMAGE_TAG=' ${REMOTE_DIR}/.env > ${REMOTE_DIR}/.env.tmp || true; echo IMAGE_TAG=${TAG} >> ${REMOTE_DIR}/.env.tmp; mv ${REMOTE_DIR}/.env.tmp ${REMOTE_DIR}/.env"

echo "==> Pulling and restarting on server..."
ssh ${SERVER} "cd ${REMOTE_DIR} && docker compose pull && docker compose --env-file .env up -d"

echo "==> Done!"
