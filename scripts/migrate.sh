#!/bin/bash
# MoshSplit Database Migration Script
# Runs Sentinel migrations using the official image

set -e

cd /opt/moshsplit

echo "====================================="
echo "MoshSplit Database Migration"
echo "====================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please run setup first or create .env file."
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Start database if not running
echo "Starting database..."
docker compose up -d postgres

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Check database health
if ! docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "ERROR: Database is not ready. Check logs:"
    docker compose logs postgres
    exit 1
fi

echo "Database is ready!"

# Run migrations using official Sentinel image
echo ""
echo "Running Sentinel migrations..."
docker run --rm \
  --network moshsplit_app-net \
  -e DATABASE_URL="$DATABASE_URL" \
  ghcr.io/graned/sentinel-core:$SENTINEL_VERSION \
  sentinel-core migrations run

echo ""
echo "====================================="
echo "Migrations Complete!"
echo "====================================="
echo ""
echo "Next step: Deploy all services"
echo "  docker compose up -d"
echo ""
