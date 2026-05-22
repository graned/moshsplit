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
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
SENTINEL_VERSION="${SENTINEL_VERSION:-v1.3.0}"

# Determine DATABASE_URL
if [ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_PASSWORD" ]; then
    DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/postgres"
fi

# Determine AUTH_DATABASE_URL (for Sentinel migrations)
if [ -z "$AUTH_DATABASE_URL" ] && [ -n "$POSTGRES_PASSWORD" ]; then
    AUTH_DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${DATABASE_NAME}"
fi

# Validate required variables
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${RED}ERROR: POSTGRES_PASSWORD is required${NC}"
    echo ""
    echo "Set it in .env file or export it:"
    echo "  export POSTGRES_PASSWORD='your_password'"
    exit 1
fi

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  MoshSplit Sentinel Database Setup${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Database:        ${DATABASE_NAME}"
echo "  Host:            ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "  User:            ${POSTGRES_USER}"
echo "  Sentinel Version: ${SENTINEL_VERSION}"
echo "  Migrate Only:    ${MIGRATE_ONLY}"
echo "  Dry Run:         ${DRY_RUN}"
echo ""

# Function to run SQL command
run_sql() {
    local sql="$1"
    local db="${2:-postgres}"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN] Would execute SQL on $db:${NC}"
        echo "$sql"
        return 0
    fi
    
    # Check if running in Docker context
    if docker ps --format '{{.Names}}' | grep -q "moshsplit-postgres"; then
        docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$db" -c "$sql"
    else
        PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$db" -c "$sql"
    fi
}

# =============================================================================
# STEP 1: Create Database (if using separate sentinel_auth database)
# =============================================================================

if [ "$MIGRATE_ONLY" = false ]; then
    echo -e "${YELLOW}Step 1: Creating database...${NC}"
    
    # Check if database exists
    DB_EXISTS=$(run_sql "SELECT 1 FROM pg_database WHERE datname = '${DATABASE_NAME}';" postgres 2>/dev/null || echo "")
    
    if [ -z "$DB_EXISTS" ]; then
        echo "  → Creating database: ${DATABASE_NAME}"
        run_sql "CREATE DATABASE ${DATABASE_NAME};" postgres
        echo -e "  ${GREEN}✓ Database created${NC}"
    else
        echo -e "  ${GREEN}✓ Database already exists${NC}"
    fi
    echo ""
    
    # =============================================================================
    # STEP 2: Create auth Schema
    # =============================================================================
    
    echo -e "${YELLOW}Step 2: Creating auth schema...${NC}"
    
    run_sql "CREATE SCHEMA IF NOT EXISTS auth;" "$DATABASE_NAME"
    echo -e "  ${GREEN}✓ Schema created${NC}"
    echo ""
    
    # =============================================================================
    # STEP 3: Create Roles (if needed)
    # =============================================================================
    
    echo -e "${YELLOW}Step 3: Creating roles...${NC}"
    
    # Create sentinel role
    run_sql "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sentinel') THEN CREATE ROLE sentinel LOGIN PASSWORD 'sentinel_dev'; END IF; END \$\$;" "$DATABASE_NAME"
    echo "  → Created 'sentinel' role"
    
    # Create pitboss role (optional, for cross-schema access)
    run_sql "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pitboss') THEN CREATE ROLE pitboss LOGIN PASSWORD 'password'; END IF; END \$\$;" "$DATABASE_NAME"
    echo "  → Created 'pitboss' role"
    
    echo -e "  ${GREEN}✓ Roles created${NC}"
    echo ""
    
    # =============================================================================
    # STEP 4: Grant Permissions
    # =============================================================================
    
    echo -e "${YELLOW}Step 4: Granting permissions...${NC}"
    
    # Grant schema permissions to sentinel
    run_sql "GRANT USAGE ON SCHEMA auth TO sentinel;" "$DATABASE_NAME"
    run_sql "GRANT CREATE ON SCHEMA auth TO sentinel;" "$DATABASE_NAME"
    run_sql "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth GRANT ALL ON TABLES TO sentinel;" "$DATABASE_NAME"
    run_sql "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth GRANT ALL ON SEQUENCES TO sentinel;" "$DATABASE_NAME"
    run_sql "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth GRANT ALL ON FUNCTIONS TO sentinel;" "$DATABASE_NAME"
    
    # Set search_path for sentinel user
    run_sql "ALTER ROLE sentinel SET search_path TO auth;" "$DATABASE_NAME"
    
    echo -e "  ${GREEN}✓ Permissions granted${NC}"
    echo ""
    
    # =============================================================================
    # STEP 5: Create pgcrypto Extension
    # =============================================================================
    
    echo -e "${YELLOW}Step 5: Creating pgcrypto extension...${NC}"
    
    run_sql "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA auth;" "$DATABASE_NAME"
    run_sql "GRANT EXECUTE ON FUNCTION auth.crypt(text, text) TO sentinel;" "$DATABASE_NAME"
    run_sql "GRANT EXECUTE ON FUNCTION auth.gen_salt(text) TO sentinel;" "$DATABASE_NAME"
    run_sql "GRANT EXECUTE ON FUNCTION auth.gen_salt(text, integer) TO sentinel;" "$DATABASE_NAME"
    run_sql "GRANT EXECUTE ON FUNCTION auth.gen_random_uuid() TO sentinel;" "$DATABASE_NAME"
    
    echo -e "  ${GREEN}✓ Extension created and permissions granted${NC}"
    echo ""
fi

# =============================================================================
# STEP 6: Run Sentinel Migrations
# =============================================================================

echo -e "${YELLOW}Step 6: Running Sentinel migrations...${NC}"
echo "  Version: ${SENTINEL_VERSION}"
echo "  Database URL: ${AUTH_DATABASE_URL}"
echo ""

# Clone Sentinel repo if not exists
if [ ! -d "/tmp/sentinel" ]; then
    echo "  → Cloning Sentinel repository..."
    git clone --depth 1 --branch "$SENTINEL_VERSION" https://github.com/graned/sentinel.git /tmp/sentinel 2>/dev/null || \
    git clone --depth 1 https://github.com/graned/sentinel.git /tmp/sentinel
    echo -e "  ${GREEN}✓ Repository cloned${NC}"
else
    echo "  → Updating existing clone..."
    cd /tmp/sentinel
    git fetch --tags
    git checkout "$SENTINEL_VERSION" 2>/dev/null || git checkout "main"
    cd - > /dev/null
    echo -e "  ${GREEN}✓ Repository updated${NC}"
fi

# Build migration Docker image
echo "  → Building migration container..."
cd /tmp/sentinel

cat > /tmp/Dockerfile.migrate << 'EOF'
FROM rust:1.91-slim AS builder
RUN apt-get update && apt-get install -y libpq-dev pkg-config && rm -rf /var/lib/apt/lists/*
RUN cargo install diesel_cli --no-default-features --features postgres

FROM rust:1.91-slim
RUN rm -rf /usr/local/rustup /usr/local/cargo/registry /usr/local/cargo/git && \
    apt-get update && apt-get install -y --no-install-recommends libpq5 && \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/local/cargo/bin/diesel /usr/local/bin/diesel
COPY apps/sentinel-core/migrations /app/migrations
WORKDIR /app
EOF

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN] Would build Docker image and run migrations${NC}"
else
    docker build -t sentinel-migrate:test -f /tmp/Dockerfile.migrate /tmp/sentinel > /dev/null 2>&1
    
    # Determine network (Docker compose or host)
    if docker network ls --format '{{.Name}}' | grep -q "moshsplit_app-net"; then
        NETWORK="--network moshsplit_app-net"
    else
        NETWORK=""
    fi
    
    # Run migrations
    docker run --rm \
      $NETWORK \
      -e DATABASE_URL="$AUTH_DATABASE_URL" \
      sentinel-migrate:test \
      diesel migration run
    
    echo -e "  ${GREEN}✓ Migrations completed${NC}"
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
