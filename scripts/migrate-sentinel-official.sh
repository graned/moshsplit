#!/bin/bash
# MoshSplit — Run Sentinel Migrations (Official Way)
# ================================================================
# Clones Sentinel repo, uses their official Dockerfile.migrate
# This is the EXACT same method Sentinel uses in development.
#
# Usage:
#   ./scripts/migrate-sentinel-official.sh

set -e

cd /opt/moshsplit

echo "====================================="
echo "Sentinel Migrations (Official)"
echo "====================================="
echo ""

# Load environment
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

export SENTINEL_VERSION="${SENTINEL_VERSION:-v1.2.0}"
export DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required in .env}"

echo "Database: $DATABASE_URL"
echo "Sentinel version: $SENTINEL_VERSION"
echo ""

# Step 1: Ensure database is running
echo "Step 1: Starting database..."
docker compose up -d postgres
sleep 10

if ! docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "ERROR: Database not ready"
    docker compose logs postgres
    exit 1
fi
echo "✓ Database ready"
echo ""

# Step 2: Clone Sentinel repo (or pull if exists)
echo "Step 2: Getting Sentinel $SENTINEL_VERSION..."
if [ -d "/tmp/sentinel" ]; then
    echo "  → Updating existing clone..."
    cd /tmp/sentinel
    git fetch --tags
    git checkout "$SENTINEL_VERSION" 2>/dev/null || git checkout "main"
    cd - > /dev/null
else
    echo "  → Cloning repository..."
    git clone --depth 1 --branch "$SENTINEL_VERSION" https://github.com/graned/sentinel.git /tmp/sentinel 2>/dev/null || \
    git clone --depth 1 https://github.com/graned/sentinel.git /tmp/sentinel
fi
echo "✓ Sentinel repo ready"
echo ""

# Step 3: Build and run migrations using their Dockerfile
echo "Step 3: Running migrations..."
cd /tmp/sentinel

# Create a temporary docker-compose for migrations
cat > /tmp/sentinel-migrate-compose.yml << 'EOF'
services:
  migrate:
    build:
      context: .
      dockerfile: apps/sentinel-core/Dockerfile.migrate
    command: sh -c "cd apps/sentinel-core && diesel migration run"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - host
networks:
  host:
    external: true
    name: moshsplit_app-net
EOF

# Build and run
DATABASE_URL="$DATABASE_URL" docker compose -f /tmp/sentinel-migrate-compose.yml up --build

echo ""
echo "====================================="
echo "✓ Migrations Complete!"
echo "====================================="
echo ""
echo "Verify:"
echo "  docker compose exec postgres psql -U postgres -d moshsplit -c '\dt auth.*'"
echo ""
echo "Deploy Sentinel:"
echo "  docker compose up -d sentinel"
echo ""

# Cleanup
rm -f /tmp/sentinel-migrate-compose.yml
