#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
    echo "[ERROR] DATABASE_URL is required"
    exit 1
fi

# Extract host from DATABASE_URL (postgres://user:pass@host:port/db)
HOST=$(echo "$DATABASE_URL" | sed -E 's|postgres://[^:]+:[^@]+@([^:]+).*|\1|')

echo "[INFO] Waiting for postgres at $HOST..."
retries=30
while ! pg_isready -h "$HOST" -U postgres > /dev/null 2>&1; do
    retries=$((retries - 1))
    if [ $retries -eq 0 ]; then
        echo "[ERROR] PostgreSQL not available after 30 seconds"
        exit 1
    fi
    sleep 1
done
echo "[INFO] PostgreSQL is ready"

# Override search_path to auth schema (Sentinel stores tables there)
export PGOPTIONS="-c search_path=auth,public"
# Override database to sentinel_auth
export PGDATABASE=sentinel_auth

echo "[INFO] Running diesel migrations (schema: auth)..."
cd /app/apps/sentinel-core
diesel migration run

echo "[INFO] Migrations complete"