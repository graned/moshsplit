# =============================================================================
# Sentinel Migration Service - Robust, Idempotent Solution
# =============================================================================
# This Dockerfile provides a complete solution for running Sentinel migrations
# against the 'auth' schema in a fully idempotent manner.
#
# Architecture:
# - Stage 1: Clone and preprocess migrations (transform public -> auth)
# - Stage 2: Runtime container that runs migrations with proper tracking
#
# Key Features:
# - Schema transformation: All 'public.' references rewritten to 'auth.'
# - Idempotent: Safe to run multiple times with proper tracking
# - Seed data: Creates initial roles, policies, and configurations
# - Clear logging: Progress visible at each step
# - Dual mode support: Works with both dev (separate DB) and prod (single DB)
#
# Environment Variables:
# - DATABASE_URL: Full connection string (if provided, takes precedence)
# - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
# - SENTINEL_VERSION: Version of Sentinel to use (default: v1.1.0)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Clone and preprocess Sentinel migrations
# -----------------------------------------------------------------------------
FROM rust:1.91-slim AS builder

ENV SENTINEL_VERSION=v1.1.0
ENV SENTINEL_REPO=https://github.com/graned/sentinel.git
ENV MIGRATIONS_DIR=/tmp/sentinel-migrations

RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp

# Clone Sentinel repository at specified version
RUN echo "Cloning Sentinel ${SENTINEL_VERSION}..." && \
    git clone --depth 1 --branch ${SENTINEL_VERSION} ${SENTINEL_REPO} sentinel-repo

# Copy migrations and preprocess them
WORKDIR /tmp/sentinel-repo/apps/sentinel-core/migrations

# Pre-process all SQL files: replace 'public.' with 'auth.'
# This transforms the schema for all tables, indexes, constraints, etc.
# Uses word boundary \b to avoid partial matches (e.g., 'mypublic' stays intact)
RUN echo "Pre-processing migrations (public -> auth)..." && \
    for f in $(find . -name "*.sql"); do \
        sed -E 's/\bpublic\./auth./g' "$f" > "${f%.sql}-auth.sql" && \
        echo "  Processed: $f -> $(basename ${f%.sql}-auth.sql)"; \
    done && \
    echo "Migration pre-processing complete"

# Additional pass: handle cases like "TO public" or "FROM public" without trailing dot
# This catches search_path and similar references
RUN echo "Running additional schema transformations..." && \
    for f in $(find . -name "*-auth.sql"); do \
        sed -E 's/\bTO public\b/TO auth/g; s/\bFROM public\b/FROM auth/g; s/\bINTO public\b/INTO auth/g' "$f" > "${f}.tmp" && mv "${f}.tmp" "$f"; \
    done && \
    echo "Additional transformations complete"

# Create version manifest
RUN echo "Sentinel migrations version: ${SENTINEL_VERSION}" > /tmp/MANIFEST.txt && \
    ls -1 *-auth.sql >> /tmp/MANIFEST.txt

# -----------------------------------------------------------------------------
# Stage 2: Runtime - Execute migrations with idempotency
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

# Default environment variables (can be overridden)
ENV POSTGRES_HOST=postgres
ENV POSTGRES_PORT=5432
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=password
ENV POSTGRES_DB=sentinel_auth
ENV DATABASE_URL=

RUN apt-get update && apt-get install -y \
    postgresql-client \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Copy preprocessed migrations from builder
COPY --from=builder /tmp/sentinel-repo/apps/sentinel-core/migrations /migrations
COPY --from=builder /tmp/MANIFEST.txt /migrations/

WORKDIR /migrations

# =============================================================================
# Main Migration Script
# =============================================================================
RUN cat > /run-migrations.sh << 'MIGRATION_SCRIPT'
#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $(date +%H:%M:%S) $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date +%H:%M:%S) $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date +%H:%M:%S) $*"; }

# Parse DATABASE_URL if provided (for production single-database setup)
# Format: postgres://user:password@host:port/database
if [ -n "${DATABASE_URL:-}" ]; then
    log_info "Using DATABASE_URL: ${DATABASE_URL}"
    
    # Extract components from DATABASE_URL
    # Remove postgres:// prefix
    DB_URL="${DATABASE_URL#postgres://}"
    
    # Extract user:password@host:port/database
    CREDENTIALS_HOST="${DB_URL%%@*}"  # user:password
    REST="${DB_URL#*@}"  # host:port/database
    
    POSTGRES_USER="${CREDENTIALS_HOST%%:*}"
    POSTGRES_PASSWORD="${CREDENTIALS_HOST#*:}"
    HOST_PORT_DB="${REST%%/*}"  # host:port
    POSTGRES_DB="${REST#*/}"  # database
    
    POSTGRES_HOST="${HOST_PORT_DB%%:*}"
    POSTGRES_PORT="${HOST_PORT_DB#*:}"
    
    # Fallback for default port
    if [ "$POSTGRES_PORT" = "$HOST_PORT_DB" ]; then
        POSTGRES_PORT=5432
    fi
    
    log_info "Parsed from DATABASE_URL: host=$POSTGRES_HOST port=$POSTGRES_PORT user=$POSTGRES_USER db=$POSTGRES_DB"
fi

# Database connection helpers
psql() {
    command psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

psql_as_postgres() {
    command psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U postgres -d postgres "$@"
}

# =============================================================================
# Wait for PostgreSQL to be ready
# =============================================================================
wait_for_postgres() {
    log_info "Waiting for PostgreSQL..."
    local retries=30
    while ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c "SELECT 1" > /dev/null 2>&1; do
        ((retries--))
        if [ $retries -eq 0 ]; then
            log_error "PostgreSQL not available after 30 seconds"
            exit 1
        fi
        sleep 1
    done
    log_info "PostgreSQL is ready"
}

# =============================================================================
# Initialize database and schema
# =============================================================================
init_schema() {
    log_info "Initializing auth schema..."
    
    # Ensure sentinel_auth database exists
    psql_as_postgres -c "
        SELECT 'CREATE DATABASE sentinel_auth' 
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sentinel_auth')\gexec
    " || true
    
    # Create auth schema
    psql -c "CREATE SCHEMA IF NOT EXISTS auth;" 2>/dev/null || true
    
    # Ensure search_path includes auth
    psql -c "SET search_path TO auth, public;" 2>/dev/null || true
    
    log_info "Auth schema initialized"
}

# =============================================================================
# Create migration tracking table
# =============================================================================
create_migration_tracking() {
    log_info "Creating migration tracking table..."
    
    psql -c "
        CREATE TABLE IF NOT EXISTS auth._sentinel_migrations (
            migration_name VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            checksum VARCHAR(64)
        );
    " 2>/dev/null || true
    
    log_info "Migration tracking ready"
}

# =============================================================================
# Calculate file checksum for change detection
# =============================================================================
calculate_checksum() {
    md5sum "$1" | cut -d' ' -f1
}

# =============================================================================
# Apply a single migration file
# =============================================================================
apply_migration() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file" .sql)
    
    # Check if already applied (by name)
    local applied=$(psql -t -c "SELECT 1 FROM auth._sentinel_migrations WHERE migration_name = '$migration_name';" 2>/dev/null || echo "")
    
    if [ -n "$applied" ]; then
        log_warn "Migration already applied: $migration_name (skipping)"
        return 0
    fi
    
    log_info "Applying migration: $migration_name"
    
    # Apply the migration
    if psql -v ON_ERROR_STOP=1 -f "$migration_file" > /tmp/migration-output.log 2>&1; then
        # Record successful migration
        local checksum=$(calculate_checksum "$migration_file")
        psql -c "INSERT INTO auth._sentinel_migrations (migration_name, checksum) VALUES ('$migration_name', '$checksum');" 2>/dev/null || true
        log_info "Migration applied successfully: $migration_name"
    else
        # Check if error was due to already existing object (not a real error)
        if grep -q "already exists" /tmp/migration-output.log 2>/dev/null; then
            log_warn "Objects already exist (idempotent): $migration_name"
            local checksum=$(calculate_checksum "$migration_file")
            psql -c "INSERT INTO auth._sentinel_migrations (migration_name, checksum) VALUES ('$migration_name', '$checksum');" 2>/dev/null || true
        else
            log_error "Migration failed: $migration_name"
            cat /tmp/migration-output.log
            exit 1
        fi
    fi
}

# =============================================================================
# Run all migrations in order
# =============================================================================
run_migrations() {
    log_info "Running Sentinel migrations..."
    
    local migration_files=($(ls -1 *-auth.sql 2>/dev/null | sort || true))
    
    if [ ${#migration_files[@]} -eq 0 ]; then
        log_warn "No migration files found!"
        return
    fi
    
    log_info "Found ${#migration_files[@]} migration files"
    
    for migration in "${migration_files[@]}"; do
        apply_migration "$migration" || true
    done
    
    log_info "All migrations complete"
}

# =============================================================================
# Verify schema setup
# =============================================================================
verify_schema() {
    log_info "Verifying auth schema setup..."
    
    local table_count=$(psql -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'auth';" 2>/dev/null | xargs || echo "0")
    local type_count=$(psql -t -c "SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'auth';" 2>/dev/null | xargs || echo "0")
    
    log_info "Schema verification:"
    log_info "  - Tables in auth schema: $table_count"
    log_info "  - Types in auth schema: $type_count"
    
    if [ "$table_count" -lt 10 ]; then
        log_warn "Expected more tables in auth schema"
    fi
}

# =============================================================================
# Main execution
# =============================================================================
main() {
    log_info "=== Sentinel Migration Service Starting ==="
    log_info "Database: $POSTGRES_DB"
    log_info "Host: $POSTGRES_HOST:$POSTGRES_PORT"
    
    wait_for_postgres
    init_schema
    create_migration_tracking
    run_migrations
    verify_schema
    
    log_info "=== Sentinel Migration Complete ==="
}

main "$@"
MIGRATION_SCRIPT

RUN chmod +x /run-migrations.sh

# =============================================================================
# Seed Data Script
# =============================================================================
RUN cat > /seed-data.sh << 'SEED_SCRIPT'
#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $(date +%H:%M:%S) $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $(date +%H:%M:%S) $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date +%H:%M:%S) $*"; }

# Parse DATABASE_URL if provided (for production single-database setup)
if [ -n "${DATABASE_URL:-}" ]; then
    log_info "Using DATABASE_URL for seed data: ${DATABASE_URL}"
    
    # Extract components from DATABASE_URL
    DB_URL="${DATABASE_URL#postgres://}"
    CREDENTIALS_HOST="${DB_URL%%@*}"
    REST="${DB_URL#*@}"
    
    POSTGRES_USER="${CREDENTIALS_HOST%%:*}"
    POSTGRES_PASSWORD="${CREDENTIALS_HOST#*:}"
    HOST_PORT_DB="${REST%%/*}"
    POSTGRES_DB="${REST#*/}"
    
    POSTGRES_HOST="${HOST_PORT_DB%%:*}"
    POSTGRES_PORT="${HOST_PORT_DB#*:}"
    
    if [ "$POSTGRES_PORT" = "$HOST_PORT_DB" ]; then
        POSTGRES_PORT=5432
    fi
fi

# Wait for PostgreSQL to be ready (same as migration script)
wait_for_postgres() {
    log_info "Waiting for PostgreSQL (seed data)..."
    local retries=30
    while ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c "SELECT 1" > /dev/null 2>&1; do
        ((retries--))
        if [ $retries -eq 0 ]; then
            log_error "PostgreSQL not available after 30 seconds"
            exit 1
        fi
        sleep 1
    done
    log_info "PostgreSQL is ready for seed data"
}

psql() {
    command psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

seed_roles() {
    log_info "Seeding default roles..."
    
    psql -c "
        -- Admin role (if not exists)
        INSERT INTO auth.roles (name, description, created_at, updated_at)
        SELECT 'admin', 'Administrator with full system access', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM auth.roles WHERE name = 'admin');
        
        -- User role (if not exists)
        INSERT INTO auth.roles (name, description, created_at, updated_at)
        SELECT 'user', 'Standard user with basic access', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM auth.roles WHERE name = 'user');
    " 2>/dev/null || log_warn "Roles may already exist"
    
    log_info "Roles seeded"
}

seed_policies() {
    log_info "Seeding default policies..."
    
    psql -c "
        -- Admin policy
        INSERT INTO auth.policies (name, description, created_at, updated_at)
        SELECT 'admin-policy', 'Full administrative access to all endpoints', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM auth.policies WHERE name = 'admin-policy');
        
        -- User policy
        INSERT INTO auth.policies (name, description, created_at, updated_at)
        SELECT 'user-policy', 'Standard user access to personal endpoints', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM auth.policies WHERE name = 'user-policy');
    " 2>/dev/null || log_warn "Policies may already exist"
    
    log_info "Policies seeded"
}

seed_policy_rules() {
    log_info "Seeding policy rules..."
    
    psql -c "
        DO \$\$
        DECLARE
            admin_policy_id UUID;
            user_policy_id UUID;
        BEGIN
            -- Get policy IDs
            SELECT id INTO admin_policy_id FROM auth.policies WHERE name = 'admin-policy' LIMIT 1;
            SELECT id INTO user_policy_id FROM auth.policies WHERE name = 'user-policy' LIMIT 1;
            
            -- Admin policy: full access
            IF admin_policy_id IS NOT NULL THEN
                INSERT INTO auth.policy_versions (policy_id, version, rules, created_at)
                SELECT admin_policy_id, 1,
                '{\"rules\": [
                    {\"method\": \"*\", \"path\": \"/v1/api/admin/**\", \"roles\": [\"admin\"]},
                    {\"method\": \"*\", \"path\": \"/v1/api/user/**\", \"roles\": [\"admin\", \"user\"]},
                    {\"method\": \"*\", \"path\": \"/v1/api/auth/**\", \"roles\": [\"admin\", \"user\"]},
                    {\"method\": \"GET\", \"path\": \"/v1/api/system/health\", \"roles\": [\"admin\", \"user\"]}
                ]}',
                NOW()
                WHERE NOT EXISTS (SELECT 1 FROM auth.policy_versions WHERE policy_id = admin_policy_id);
            END IF;
            
            -- User policy: limited access
            IF user_policy_id IS NOT NULL THEN
                INSERT INTO auth.policy_versions (policy_id, version, rules, created_at)
                SELECT user_policy_id, 1,
                '{\"rules\": [
                    {\"method\": \"GET\", \"path\": \"/v1/api/user/me\", \"roles\": [\"user\", \"admin\"]},
                    {\"method\": \"GET\", \"path\": \"/v1/api/user/sessions\", \"roles\": [\"user\", \"admin\"]},
                    {\"method\": \"GET\", \"path\": \"/v1/api/user/permissions\", \"roles\": [\"user\", \"admin\"]}
                ]}',
                NOW()
                WHERE NOT EXISTS (SELECT 1 FROM auth.policy_versions WHERE policy_id = user_policy_id);
            END IF;
        END
        \$\$;
    " 2>/dev/null || log_warn "Policy rules may already exist"
    
    log_info "Policy rules seeded"
}

seed_email_templates() {
    log_info "Seeding default email templates..."
    
    psql -c "
        -- Email verification template
        INSERT INTO auth.email_templates (template_type, subject, body, is_active, created_at, updated_at)
        SELECT 'EmailVerification', 'Verify your email address',
        '<!DOCTYPE html><html><body style=\"font-family: sans-serif;\"><h1>Verify Your Email</h1><p>Click the button below to verify your email address:</p><a href=\"{{link}}\" style=\"background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Verify Email</a><p>Or copy this link: {{link}}</p></body></html>',
        true, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM auth.email_templates WHERE template_type = 'EmailVerification' AND is_active = true);
        
        -- Password reset template
        INSERT INTO auth.email_templates (template_type, subject, body, is_active, created_at, updated_at)
        SELECT 'PasswordReset', 'Reset your password',
        '<!DOCTYPE html><html><body style=\"font-family: sans-serif;\"><h1>Reset Your Password</h1><p>Click the button below to reset your password:</p><a href=\"{{link}}\" style=\"background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Reset Password</a><p>Or copy this link: {{link}}</p><p>This link expires in 1 hour.</p></body></html>',
        true, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM auth.email_templates WHERE template_type = 'PasswordReset' AND is_active = true);
        
        -- Password changed notification
        INSERT INTO auth.email_templates (template_type, subject, body, is_active, created_at, updated_at)
        SELECT 'PasswordChanged', 'Your password has been changed',
        '<!DOCTYPE html><html><body style=\"font-family: sans-serif;\"><h1>Password Changed</h1><p>Your password has been successfully changed.</p><p>If you did not make this change, please contact support immediately.</p></body></html>',
        true, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM auth.email_templates WHERE template_type = 'PasswordChanged' AND is_active = true);
    " 2>/dev/null || log_warn "Email templates may already exist"
    
    log_info "Email templates seeded"
}

# Verify seed data exists
verify_seed_data() {
    log_info "Verifying seed data..."
    
    local roles_count=$(psql -t -c "SELECT COUNT(*) FROM auth.roles;" 2>/dev/null | xargs || echo "0")
    local policies_count=$(psql -t -c "SELECT COUNT(*) FROM auth.policies;" 2>/dev/null | xargs || echo "0")
    local templates_count=$(psql -t -c "SELECT COUNT(*) FROM auth.email_templates WHERE is_active = true;" 2>/dev/null | xargs || echo "0")
    
    log_info "Seed data verification:"
    log_info "  - Roles: $roles_count"
    log_info "  - Policies: $policies_count"
    log_info "  - Active email templates: $templates_count"
}

# Main seed execution
main() {
    log_info "=== Starting Seed Data Script ==="
    
    wait_for_postgres
    
    seed_roles
    seed_policies
    seed_policy_rules
    seed_email_templates
    verify_seed_data
    
    log_info "=== Seed Data Complete ==="
}

main "$@"
SEED_SCRIPT

RUN chmod +x /seed-data.sh

# Run migrations then seed data
CMD ["/bin/bash", "-c", "/run-migrations.sh && /seed-data.sh"]