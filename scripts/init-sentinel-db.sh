#!/bin/bash
# MoshSplit - Initialize Sentinel Database
# Creates auth schema and runs Sentinel migrations

set -e

cd /opt/moshsplit

echo "====================================="
echo "Sentinel Database Initialization"
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
sleep 10

echo "Creating auth schema..."
docker compose exec -T postgres psql -U postgres -d moshsplit << 'EOSQL'
-- Create auth schema if not exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Grant permissions
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;
EOSQL

echo "Downloading Sentinel migrations..."
MIGRATIONS_URL="https://raw.githubusercontent.com/graned/sentinel/main/apps/sentinel-core/migrations"

# Download and run each migration
for i in 00000000000000 00000000000001 00000000000002 00000000000003 00000000000004 00000000000005; do
  echo "Running migration $i..."
  curl -sL "$MIGRATIONS_URL/$i_up.sql" 2>/dev/null | \
    docker compose exec -T postgres psql -U postgres -d moshsplit || true
done

echo ""
echo "====================================="
echo "Sentinel Initialization Complete!"
echo "====================================="
echo ""
echo "Verify with:"
echo "  docker compose exec postgres psql -U postgres -d moshsplit -c '\dt auth.*'"
echo ""
echo "Now restart Sentinel:"
echo "  docker compose up -d sentinel"
