#!/bin/sh
set -e
cd /app

echo "[api] prisma migrate deploy…"
if ! pnpm --filter @at72-verse/db migrate:deploy; then
  echo "[api] ERROR: migrate failed — check DATABASE_URL (prefer Neon DIRECT host without -pooler) and CREATE EXTENSION vector"
  exit 1
fi

echo "[api] starting Nest…"
exec pnpm --filter @at72-verse/api start
