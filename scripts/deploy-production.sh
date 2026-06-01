#!/usr/bin/env bash
# Production deploy script for unihelper
# Run on the production server: bash scripts/deploy-production.sh

set -e

DEPLOY_DIR="/home/raju/unihelper"
PM2_ID="25"

echo "==> Pulling latest code..."
cd "$DEPLOY_DIR"
git pull

echo "==> Installing dependencies..."
npm ci --omit=dev

echo "==> Running database migrations..."
npx prisma migrate deploy

echo "==> Regenerating Prisma client..."
npx prisma generate

echo "==> Building app..."
npm run build

echo "==> Restarting PM2 process..."
pm2 restart "$PM2_ID"

echo "==> Done. Tailing logs for 5 seconds..."
sleep 2
pm2 logs "$PM2_ID" --lines 20 --nostream
