#!/bin/bash
# MoshSplit — Complete Sentinel Database Setup
# ==============================================================================
# This script handles the COMPLETE initialization of Sentinel database:
#   1. Creates sentinel_auth database (if using separate DB)
#   2. Creates auth schema
#   3. Creates required roles/users
#   4. Grants permissions
#   5. Runs Sentinel migrations
#
# Works for both LOCAL DEV and PRODUCTION
#
# Usage:
#   ./scripts/setup-sentinel-db.sh [OPTIONS]
#
# Options:
#   --env <file>      Path to .env file (default: .env or .env.local)
#   --database <name> Database name (default: sentinel_auth)
#   --migrate-only    Skip setup, only run migrations
#   --dry-run         Show what would be done without executing
#   --help            Show this help message
#
# Environment Variables (set in .env or export):
#   DATABASE_URL              Full PostgreSQL connection string
#   AUTH_DATABASE_URL         Sentinel auth database URL (optional, defaults to DATABASE_URL)
#   POSTGRES_USER             PostgreSQL superuser (default: postgres)
#   POSTGRES_PASSWORD         PostgreSQL password
#   POSTGRES_HOST             PostgreSQL host (default: postgres or localhost)
#   POSTGRES_PORT             PostgreSQL port (default: 5432)
#   SENTINEL_VERSION          Sentinel version to migrate (default: v1.3.0)
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENV_FILE=""
DATABASE_NAME="sentinel_auth"
MIGRATE_ONLY=false
DRY_RUN=false
SENTINEL_VERSION="${SENTINEL_VERSION:-v1.3.0}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --database)
            DATABASE_NAME="$2"
            shift 2
            ;;
        --migrate-only)
            MIGRATE_ONLY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            head -35 "$0" | tail -30
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Find .env file
if [ -n "$ENV_FILE" ]; then
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}ERROR: .env file not found: $ENV_FILE${NC}"
        exit 1
    fi
elif [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

# Load environment variables
if [ -n "$ENV_FILE" ]; then
    echo -e "${BLUE}Loading environment from: $ENV_FILE${NC}"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Set defaults if not provided
SENTINEL_VERSION="${SENTINEL_VERSION:-v1.3.0}"

if [ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_PASSWORD" ]; then
    POSTGRES_USER="${POSTGRES_USER:-postgres}"
    POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
    POSTGRES_PORT="${POSTGRES_PORT:-5432}"
    DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/postgres"
fi

if [ -z "$AUTH_DATABASE_URL" ] && [ -n "$POSTGRES_PASSWORD" ]; then
    POSTGRES_USER="${POSTGRES_USER:-postgres}"
    POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
    POSTGRES_PORT="${POSTGRES_PORT:-5432}"
    AUTH_DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${DATABASE_NAME}"
fi

POSTGRES_ADMIN_URL="${POSTGRES_ADMIN_URL:-$(echo "$AUTH_DATABASE_URL" | sed 's|\(://[^/]*\)/[^/?]*\(\?.*\)\?|\1/postgres\2|')}"

if [ -z "$DATABASE_URL" ] && [ -z "$AUTH_DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL or AUTH_DATABASE_URL is required${NC}"
    echo ""
    echo "Set in .env file or export:"
    echo "  DATABASE_URL=postgres://user:pass@host:port/dbname?sslmode=require"
    echo "  AUTH_DATABASE_URL=postgres://user:pass@host:port/sentinel_auth?sslmode=require"
    exit 1
fi

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  MoshSplit Sentinel Database Setup${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Database:        ${DATABASE_NAME}"
echo "  Sentinel Version: ${SENTINEL_VERSION}"
echo "  Migrate Only:    ${MIGRATE_ONLY}"
echo "  Dry Run:         ${DRY_RUN}"
echo ""

# Function to run SQL command
run_sql() {
    local sql="$1"
    local url="$2"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN] Would execute SQL:${NC}"
        echo "$sql"
        return 0
    fi

    if docker ps --format '{{.Names}}' | grep -q "moshsplit-db"; then
        docker exec -i moshsplit-db psql "$url" -c "$sql"
    else
        psql "$url" -c "$sql"
    fi
}

# =============================================================================
# STEP 1: Create Database (if using separate sentinel_auth database)
# =============================================================================

if [ "$MIGRATE_ONLY" = false ]; then
    echo -e "${YELLOW}Step 1: Creating database...${NC}"

    if [ "$DRY_RUN" = false ]; then
        if docker ps --format '{{.Names}}' | grep -q "moshsplit-db"; then
            DB_EXISTS=$(docker exec -i moshsplit-db psql "$POSTGRES_ADMIN_URL" -tA -c "SELECT 1 FROM pg_database WHERE datname = '${DATABASE_NAME}';")
        else
            DB_EXISTS=$(psql "$POSTGRES_ADMIN_URL" -tA -c "SELECT 1 FROM pg_database WHERE datname = '${DATABASE_NAME}';")
        fi
    else
        DB_EXISTS=""
    fi

    if [ -z "$DB_EXISTS" ] || [ "$DB_EXISTS" != "1" ]; then
        echo "  → Creating database: ${DATABASE_NAME}"
        run_sql "CREATE DATABASE ${DATABASE_NAME};" "$POSTGRES_ADMIN_URL"
        echo -e "  ${GREEN}✓ Database created${NC}"
    else
        echo -e "  ${GREEN}✓ Database already exists${NC}"
    fi
    echo ""

    # =============================================================================
    # STEP 2: Create auth Schema
    # =============================================================================

    echo -e "${YELLOW}Step 2: Creating auth schema...${NC}"

    run_sql "CREATE SCHEMA IF NOT EXISTS auth;" "$AUTH_DATABASE_URL"
    echo -e "  ${GREEN}✓ Schema created${NC}"
    echo ""

    # =============================================================================
    # STEP 3: Create Roles (if needed)
    # =============================================================================

    echo -e "${YELLOW}Step 3: Creating roles...${NC}"

    # Create sentinel role
    run_sql "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sentinel') THEN CREATE ROLE sentinel LOGIN PASSWORD 'sentinel_dev'; END IF; END \$\$;" "$AUTH_DATABASE_URL"
    echo "  → Created 'sentinel' role"

    echo -e "  ${GREEN}✓ Roles created${NC}"
    echo ""

    # =============================================================================
    # STEP 4: Grant Permissions
    # =============================================================================

    echo -e "${YELLOW}Step 4: Granting permissions...${NC}"

    # Grant schema permissions to sentinel
    run_sql "GRANT USAGE ON SCHEMA auth TO sentinel;" "$AUTH_DATABASE_URL"
    run_sql "GRANT CREATE ON SCHEMA auth TO sentinel;" "$AUTH_DATABASE_URL"
    run_sql "ALTER ROLE sentinel SET search_path TO auth, public;" "$AUTH_DATABASE_URL"

    echo -e "  ${GREEN}✓ Permissions granted${NC}"
    echo ""

    # =============================================================================
    # STEP 5: Create pgcrypto Extension
    # =============================================================================

    echo -e "${YELLOW}Step 5: Creating pgcrypto extension...${NC}"

    # Move pgcrypto to public schema if it exists elsewhere, otherwise create it
    run_sql "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto' AND extnamespace != (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN ALTER EXTENSION pgcrypto SET SCHEMA public; ELSE CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public; END IF; END \$\$;" "$AUTH_DATABASE_URL"
    run_sql "GRANT EXECUTE ON FUNCTION public.crypt(text, text) TO sentinel;" "$AUTH_DATABASE_URL"
    run_sql "GRANT EXECUTE ON FUNCTION public.gen_salt(text) TO sentinel;" "$AUTH_DATABASE_URL"
    run_sql "GRANT EXECUTE ON FUNCTION public.gen_salt(text, integer) TO sentinel;" "$AUTH_DATABASE_URL"
    run_sql "GRANT EXECUTE ON FUNCTION public.gen_random_uuid() TO sentinel;" "$AUTH_DATABASE_URL"

    echo -e "  ${GREEN}✓ Extension created and permissions granted${NC}"
    echo ""
fi

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  ✓ Sentinel Database Setup Complete!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Verify tables: docker compose exec postgres psql -U postgres -d ${DATABASE_NAME} -c '\\dt auth.*'"
echo "  2. Start Sentinel: docker compose up -d sentinel"
echo "  3. Check logs: docker compose logs -f sentinel"
echo ""
echo -e "${YELLOW}To create an API token:${NC}"
echo "  Use Sentinel UI or run:"
echo "  docker compose exec sentinel ./sentinel-core api-token create --name 'test_token'"
echo ""
