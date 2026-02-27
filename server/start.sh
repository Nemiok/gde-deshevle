#!/bin/bash
# Startup script for Railway deployment.
# 1. Runs DB migrations (idempotent — safe to re-run).
# 2. Starts the Node.js API server.
#
# Requires: DATABASE_URL env var pointing to PostgreSQL.
# Requires: psql (included in node:20-slim via apt below, or skip if unavailable).

set -e

echo "[start.sh] Checking for database initialization..."

# Only run DB init if psql is available and DATABASE_URL is set
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  echo "[start.sh] Running schema.sql..."
  psql "$DATABASE_URL" -f /app/dist/db/schema.sql 2>&1 || echo "[start.sh] Schema may already exist — continuing"

  echo "[start.sh] Running seed.sql..."
  psql "$DATABASE_URL" -f /app/dist/db/seed.sql 2>&1 || echo "[start.sh] Seed may already exist — continuing"

  echo "[start.sh] Running seed-prices.sql..."
  psql "$DATABASE_URL" -f /app/dist/db/seed-prices.sql 2>&1 || echo "[start.sh] Price seed may already exist — continuing"

  echo "[start.sh] Database initialization complete."
else
  echo "[start.sh] psql not found or DATABASE_URL not set — skipping DB init."
  echo "[start.sh] Run init-db.sh manually if needed."
fi

echo "[start.sh] Starting API server..."
exec node /app/dist/app.js
