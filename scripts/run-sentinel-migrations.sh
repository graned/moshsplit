#!/bin/bash
# MoshSplit — Run Sentinel Migrations Only
# ==============================================================================
# Quick script to run Sentinel migrations without full database setup.
# Use this when you already have the database/schema created and just need
# to apply new migrations (e.g., after Sentinel version upgrade).
#
# Usage:
#   ./scripts/run-sentinel-migrations.sh [OPTIONS]
#
# Options:
#   --env <file>      Path to .env file (default: .env or .env.local)
#   --version <tag>   Sentinel version (default: v1.3.0)
#   --dry-run         Show what would be done without executing
#   --help            Show this help message
#
# Environment Variables:
#   AUTH_DATABASE_URL   Sentinel database connection string (REQUIRED)
#   SENTINEL_VERSION    Version to migrate (default: v1.3.0)
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
ENV_FILE=""
SENTINEL_VERSION="${SENTINEL_VERSION:-v1.3.0}"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --version)
            SENTINEL_VERSION="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            head -25 "$0" | tail -20
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
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

# Load environment
if [ -n "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
elif [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs)
elif [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Auto-detect: If running inside Docker, use 'postgres' hostname
# If running from host, use 'localhost'
if [ -z "$POSTGRES_HOST" ]; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "moshsplit-postgres"; then
        # Running on host, but Docker container exists
        POSTGRES_HOST="localhost"
        echo -e "${BLUE}Auto-detected: Using localhost (Docker container running)${NC}"
    elif docker inspect "$(hostname)" &>/dev/null && grep -q "moshsplit" /etc/resolv.conf 2>/dev/null; then
        # Running inside Docker container
        POSTGRES_HOST="postgres"
        echo -e "${BLUE}Auto-detected: Running inside Docker network${NC}"
    else
        # Default to localhost
        POSTGRES_HOST="localhost"
        echo -e "${BLUE}Auto-detected: Using localhost${NC}"
    fi
fi

# Validate
if [ -z "$AUTH_DATABASE_URL" ]; then
    echo -e "${RED}ERROR: AUTH_DATABASE_URL is required${NC}"
    echo ""
    echo "Set it in .env file:"
    echo "  AUTH_DATABASE_URL=postgres://user:pass@host:5432/sentinel_auth"
    echo ""
    echo "Or export it:"
    echo "  export AUTH_DATABASE_URL='postgres://...'"
    exit 1
fi

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Sentinel Migrations${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Version:  ${SENTINEL_VERSION}"
echo "  Database: ${AUTH_DATABASE_URL}"
echo "  Dry Run:  ${DRY_RUN}"
echo ""

# Clone/update Sentinel repo
if [ ! -d "/tmp/sentinel" ]; then
    echo -e "${YELLOW}Cloning Sentinel repository...${NC}"
    git clone --depth 1 --branch "$SENTINEL_VERSION" https://github.com/graned/sentinel.git /tmp/sentinel 2>/dev/null || \
    git clone --depth 1 https://github.com/graned/sentinel.git /tmp/sentinel
else
    echo -e "${YELLOW}Updating existing clone...${NC}"
    cd /tmp/sentinel
    git fetch --tags
    git checkout "$SENTINEL_VERSION" 2>/dev/null || git checkout "main"
    cd - > /dev/null
fi

# Build migration image
echo -e "${YELLOW}Building migration container...${NC}"
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
    echo -e "${YELLOW}[DRY-RUN] Would build and run migrations${NC}"
else
    docker build -t sentinel-migrate:test -f /tmp/Dockerfile.migrate /tmp/sentinel > /dev/null 2>&1
    
    # Determine network
    if docker network ls --format '{{.Name}}' | grep -q "moshsplit_app-net"; then
        NETWORK="--network moshsplit_app-net"
    else
        NETWORK=""
    fi
    
    echo -e "${YELLOW}Running migrations...${NC}"

# Pre-check: Create pgcrypto if it doesn't exist (needed for migrations)
echo "  → Ensuring pgcrypto extension exists..."
if docker ps --format '{{.Names}}' | grep -q "moshsplit-postgres"; then
    docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$DATABASE_NAME" -c \
      "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || true
else
    PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$DATABASE_NAME" -c \
      "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || true
fi
    
    # Determine network and host
    if docker network ls --format '{{.Name}}' | grep -q "moshsplit"; then
        # Use host.docker.internal to reach host machine from container
        # On Linux, need to use special DNS or host network mode
        if [ "$(uname)" = "Linux" ]; then
            # Linux: Use host network mode
            docker run --rm \
              --network host \
              -e DATABASE_URL="$AUTH_DATABASE_URL" \
              sentinel-migrate:test \
              diesel migration run
        else
            # macOS/Windows: host.docker.internal works
            docker run --rm \
              -e DATABASE_URL="$AUTH_DATABASE_URL" \
              sentinel-migrate:test \
              diesel migration run
        fi
    else
        # No network, try host mode
        docker run --rm \
          --network host \
          -e DATABASE_URL="$AUTH_DATABASE_URL" \
          sentinel-migrate:test \
          diesel migration run
    fi
fi

echo ""
echo -e "${GREEN}✓ Migrations complete!${NC}"
echo ""
echo -e "${BLUE}Verify:${NC}"
echo "  docker compose exec postgres psql -U postgres -d sentinel_auth -c '\\dt auth.*'"
echo ""
