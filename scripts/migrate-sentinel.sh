#!/bin/bash
# MoshSplit — Run Sentinel Migrations (Docker-aware)
# Automatically detects if running from host or inside Docker
# ==============================================================================

set -e

cd "$(dirname "$0")/.."

# Check if running inside Docker
if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    echo "Running inside Docker container"
    INSIDE_DOCKER=true
    POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
else
    echo "Running on host machine"
    INSIDE_DOCKER=false
    POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
fi

# Load .env if exists
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
elif [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Build DATABASE_URL if not set
if [ -z "$AUTH_DATABASE_URL" ]; then
    POSTGRES_USER="${POSTGRES_USER:-postgres}"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-password}"
    POSTGRES_PORT="${POSTGRES_PORT:-5432}"
    DATABASE_NAME="${DATABASE_NAME:-sentinel_auth}"
    
    AUTH_DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${DATABASE_NAME}"
fi

export AUTH_DATABASE_URL
export POSTGRES_HOST

echo ""
echo "====================================="
echo "  Sentinel Migrations"
echo "====================================="
echo "  Host: $POSTGRES_HOST"
echo "  Database: $AUTH_DATABASE_URL"
echo "====================================="
echo ""

# Run migrations
./scripts/run-sentinel-migrations.sh "$@"
