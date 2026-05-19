#!/bin/bash
# MoshSplit - Run Sentinel Migrations
# This script runs Sentinel database migrations using diesel

set -e

cd /opt/moshsplit

echo "====================================="
echo "Sentinel Database Migrations"
echo "====================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

echo "Starting database..."
docker compose up -d postgres

# Wait for database
echo "Waiting for database to be ready..."
sleep 10

if ! docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "ERROR: Database is not ready"
    docker compose logs postgres
    exit 1
fi

echo "Database is ready!"
echo ""

# Run migrations using diesel CLI inside the sentinel container
# We'll exec into a temporary container with diesel installed
echo "Running Sentinel migrations..."

# Create a temporary container to run diesel migrations
docker run --rm \
  --network moshsplit_app-net \
  -e DATABASE_URL="$DATABASE_URL" \
  -v /tmp/migrations:/app/apps/sentinel-core/migrations \
  rust:1.91-slim \
  sh -c "
    apt-get update && apt-get install -y libpq-dev && \
    cargo install diesel_cli --no-default-features --features postgres && \
    cd /app/apps/sentinel-core && \
    diesel migration run
  "

echo ""
echo "====================================="
echo "Migrations Complete!"
echo "====================================="
echo ""
echo "Verify with:"
echo "  docker compose exec postgres psql -U postgres -d moshsplit -c '\dt auth.*'"
