#!/bin/bash
cd /opt/moshsplit
export $(grep -v '^#' .env | xargs)

echo "Starting database..."
docker compose up -d postgres
sleep 10

echo "Running Sentinel migrations..."
docker run --rm \
  --network moshsplit_app-net \
  -e DATABASE_URL="$DATABASE_URL" \
  ghcr.io/graned/sentinel-core:$SENTINEL_VERSION \
  sentinel-core migrations run

echo "Migrations complete!"
