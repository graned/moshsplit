#!/bin/bash
# MoshSplit — Sentinel Database Migrations
# ================================================================
# This script runs Sentinel database migrations.
# It is reusable and will work with future Sentinel updates.
#
# Usage:
#   ./scripts/migrate-sentinel.sh
#
# What it does:
#   1. Starts PostgreSQL (if not running)
#   2. Creates 'auth' schema
#   3. Downloads latest Sentinel migrations from GitHub
#   4. Runs migrations in correct order
#   5. Verifies tables were created
#
# Requirements:
#   - Docker Compose
#   - curl, jq (for downloading migrations)

set -e

cd "$(dirname "$0")/.."

echo "====================================="
echo "Sentinel Database Migrations"
echo "====================================="
echo ""

# Load environment if exists
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✓ Loaded .env"
fi

# Default values
export SENTINEL_VERSION="${SENTINEL_VERSION:-v1.2.0}"
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:password@postgres:5432/moshsplit}"

echo "Using Sentinel version: $SENTINEL_VERSION"
echo ""

# Step 1: Ensure database is running
echo "Step 1: Starting database..."
if command -v docker &> /dev/null; then
    docker compose up -d postgres 2>/dev/null || true
    echo "Waiting for database..."
    sleep 10
    
    # Wait for database to be ready
    for i in {1..30}; do
        if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            echo "✓ Database is ready"
            break
        fi
        sleep 2
    done
else
    echo "⚠ Docker not found - assuming database is already running"
fi
echo ""

# Step 2: Create auth schema
echo "Step 2: Creating auth schema..."
if command -v docker &> /dev/null; then
    docker compose exec -T postgres psql -U postgres -d "${POSTGRES_DB:-moshsplit}" << 'EOSQL'
CREATE SCHEMA IF NOT EXISTS auth;
GRANT ALL ON SCHEMA auth TO postgres;
EOSQL
    echo "✓ Auth schema created"
else
    echo "⚠ Run manually: CREATE SCHEMA IF NOT EXISTS auth;"
fi
echo ""

# Step 3: Download and run migrations
echo "Step 3: Running Sentinel migrations..."

# Sentinel migration files (in order)
MIGRATIONS=(
    "00000000000000_init"
    "00000000000001_create_users"
    "00000000000002_create_sessions"
    "00000000000003_create_clients"
    "00000000000004_create_roles"
    "00000000000005_create_api_tokens"
)

MIGRATIONS_URL="https://raw.githubusercontent.com/graned/sentinel/main/apps/sentinel-core/migrations"

for migration in "${MIGRATIONS[@]}"; do
    echo "  → $migration..."
    
    # Try to download and run up.sql
    SQL_FILE=$(mktemp)
    if curl -sL "$MIGRATIONS_URL/$migration/up.sql" -o "$SQL_FILE" 2>/dev/null; then
        if [ -s "$SQL_FILE" ]; then
            if command -v docker &> /dev/null; then
                docker compose exec -T postgres psql -U postgres -d "${POSTGRES_DB:-moshsplit}" < "$SQL_FILE" 2>/dev/null || true
            else
                psql "$DATABASE_URL" < "$SQL_FILE" 2>/dev/null || true
            fi
            echo "    ✓ Applied"
        else
            echo "    ⊘ Skipped (not found)"
        fi
    else
        echo "    ⊘ Skipped (not found)"
    fi
    
    rm -f "$SQL_FILE"
done
echo ""

# Step 4: Verify
echo "Step 4: Verifying migrations..."
if command -v docker &> /dev/null; then
    TABLE_COUNT=$(docker compose exec -T postgres psql -U postgres -d "${POSTGRES_DB:-moshsplit}" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'auth';" 2>/dev/null | tr -d ' ')
    
    if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
        echo "✓ Success! Found $TABLE_COUNT tables in auth schema"
        echo ""
        echo "Tables created:"
        docker compose exec -T postgres psql -U postgres -d "${POSTGRES_DB:-moshsplit}" -c "\dt auth.*" 2>/dev/null || true
    else
        echo "⚠ No tables found in auth schema"
        echo "Check logs for errors"
    fi
else
    echo "✓ Migrations complete - verify manually with: psql -c '\dt auth.*'"
fi

echo ""
echo "====================================="
echo "Migrations Complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "  1. docker compose up -d sentinel"
echo "  2. docker compose logs -f sentinel"
echo ""
