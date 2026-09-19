#!/usr/bin/env bash
set -euo pipefail

# Start backend services with docker-compose and frontend dev server together.
# Usage: ./dev.sh

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)

echo "Starting backend services (docker-compose)..."
docker-compose up --build -d postgres redis

echo "Running migrations..."
docker-compose -f docker-compose.yml run --rm migrate

echo "Starting backend and worker..."
docker-compose up -d backend worker

echo "Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -sS http://localhost:4000/ready | grep -q 'ok'; then
    echo "Backend ready"
    break
  fi
  sleep 1
done

echo "Starting frontend dev server..."
cd "$ROOT_DIR/frontend"
# Non-interactive pnpm install: remove node_modules and install fresh
rm -rf node_modules
pnpm install --shamefully-hoist --no-frozen-lockfile --reporter=silent
pnpm dev &

echo "All started. Frontend running on http://localhost:4173 and backend on http://localhost:4000"
