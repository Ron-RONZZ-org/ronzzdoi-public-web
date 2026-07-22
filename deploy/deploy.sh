#!/usr/bin/env bash
set -euo pipefail

# ronzzdoi-public-web deployment script
# Usage: sudo ./deploy/deploy.sh

APP_DIR="/opt/ronzzdoi-public-web"
SERVICE="ronzzdoi-web"

echo "=== ronzzdoi-public-web deploy ==="

cd "$APP_DIR"

echo "→ Pulling latest code..."
git pull

echo "→ Installing dependencies..."
npm ci

echo "→ Building..."
npm run build

echo "→ Restarting service..."
systemctl restart "$SERVICE"

echo "→ Checking status..."
sleep 2
systemctl status "$SERVICE" --no-pager

echo "=== Done ==="
