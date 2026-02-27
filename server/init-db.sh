#!/bin/bash
# Initialize the database with schema, seed data, and prices.
# Usage: DATABASE_URL=... ./init-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Running schema..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/src/db/schema.sql"

echo "Running seed data..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/src/db/seed.sql"

echo "Running price seeds..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/src/db/seed-prices.sql"

echo "Database initialized successfully!"
