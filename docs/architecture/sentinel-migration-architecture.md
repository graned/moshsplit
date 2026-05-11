# Sentinel Migration Architecture

## Problem Statement

The original Sentinel migration solution had critical issues:

1. **Schema Mismatch**: Migrations were created for `public` schema but MoshSplit uses `auth` schema for isolation
2. **Non-idempotent**: Failed on re-runs with "relation already exists" errors
3. **Incomplete Migration**: Post-hoc schema moving didn't properly handle all DB objects (enums, indexes, triggers, functions)
4. **No Tracking**: No way to know which migrations had been applied

## Solution Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Sentinel Migration Pipeline                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐ │
│  │   Git Clone  │───▶│   Pre-process │───▶│   Idempotent Apply   │ │
│  │ (v1.1.0)     │    │ (public→auth) │    │   + Tracking        │ │
│  └──────────────┘    └──────────────┘    └──────────────────────┘ │
│                                                      │              │
│                                                      ▼              │
│                                            ┌──────────────────────┐│
│                                            │   Seed Data          ││
│                                            │ (roles, policies,    ││
│                                            │  email templates)    ││
│                                            └──────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Multi-Stage Dockerfile

**Stage 1: Builder**
- Clones Sentinel repository at specified version (configurable via `SENTINEL_VERSION`)
- Pre-processes all SQL migration files
- Transforms `public.` schema references to `auth.`
- Creates manifest file of all migrations

**Stage 2: Runtime**
- Runs the actual migration and seed scripts
- Provides clear progress logging with timestamps
- Color-coded output (info/warn/error)

#### 2. Migration Pre-Processing

The `sed` transformation replaces all occurrences of `public.` with `auth.`:

```sql
-- Original (from Sentinel)
CREATE TABLE public.users (...);
CREATE INDEX idx_user_email ON public.users(email);
ALTER TABLE public.sessions ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Transformed (for MoshSplit auth schema)
CREATE TABLE auth.users (...);
CREATE INDEX idx_user_email ON auth.users(email);
ALTER TABLE auth.sessions ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id);
```

This ensures ALL schema references are correct, including:
- Table definitions
- Index definitions
- Foreign key constraints
- Function definitions
- Trigger definitions
- Sequence references
- Search path references (e.g., `SET search_path TO auth`)

The transformation uses word boundaries (`\b`) to avoid partial matches (e.g., `mypublic` stays intact).
An additional pass handles edge cases without trailing dots (e.g., `TO public` becomes `TO auth`).

#### 3. Idempotent Migration Runner

The migration runner provides these guarantees:

**Migration Tracking Table**
```sql
CREATE TABLE auth._sentinel_migrations (
    migration_name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(64)
);
```

**Idempotency Logic**
1. Before applying a migration, check if it exists in tracking table
2. If already applied, skip with warning
3. If applying fails with "already exists", record as applied (idempotent)
4. If applying fails for other reasons, fail with full error output

**Retry Safety**
- Safe to run multiple times - will skip already-applied migrations
- Track both migration name and checksum for verification

#### 4. Seed Data

Seeds required initial data idempotently:

| Data Type | Description |
|-----------|-------------|
| Roles | `admin`, `user` |
| Policies | `admin-policy`, `user-policy` |
| Policy Rules | RBAC rules for each policy |
| Email Templates | Built-in defaults for verification, password reset, password changed |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SENTINEL_VERSION` | `v1.1.0` | Sentinel version to pull |
| `POSTGRES_HOST` | `postgres` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | `password` | Database password |
| `POSTGRES_DB` | `sentinel_auth` | Target database |

### Docker Compose Integration

```yaml
services:
  sentinel-migrations:
    build:
      context: ../../
      dockerfile: infra/docker/sentinel-migrate.Dockerfile
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: sentinel_auth
      SENTINEL_VERSION: v1.1.0
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-net

  sentinel:
    image: ghcr.io/graned/sentinel-core:v1.1.0
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/sentinel_auth
      PGOPTIONS: "-c search_path=auth"
      # ... other Sentinel config
    depends_on:
      sentinel-migrations:
        condition: service_completed_successfully
```

## Operational Procedures

### Initial Setup

```bash
# Start the infrastructure
cd infra/compose
docker compose -f dev.yml up -d postgres

# Run migrations
docker compose -f dev.yml up sentinel-migrations

# Verify migrations
docker compose exec postgres psql -d sentinel_auth -c "\dt auth.*"

# Start Sentinel
docker compose -f dev.yml up -d sentinel
```

### Re-running Migrations

The solution is fully idempotent - safe to re-run:

```bash
# Re-run migrations (will skip already-applied)
docker compose up --build sentinel-migrations
```

### Resetting Migrations

To completely reset (for development):

```bash
# Drop auth schema and migration tracking
docker compose exec postgres psql -d sentinel_auth -c "
  DROP SCHEMA auth CASCADE;
  CREATE SCHEMA auth;
"

# Re-run migrations
docker compose up sentinel-migrations
```

### Debugging

Check migration status:

```bash
# List applied migrations
docker compose exec postgres psql -d sentinel_auth -c "SELECT * FROM auth._sentinel_migrations ORDER BY applied_at;"

# Check table count
docker compose exec postgres psql -d sentinel_auth -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'auth';"

# Check types (enums, composite types)
docker compose exec postgres psql -d sentinel_auth -c "SELECT COUNT(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'auth';"

# Check seed data
docker compose exec postgres psql -d sentinel_auth -c "SELECT * FROM auth.roles;"
docker compose exec postgres psql -d sentinel_auth -c "SELECT * FROM auth.policies;"
docker compose exec postgres psql -d sentinel_auth -c "SELECT template_type, subject, is_active FROM auth.email_templates;"

# View logs
docker compose logs sentinel-migrations
```

The migration script automatically verifies:
- Number of tables created in auth schema
- Number of types (enums, composites) in auth schema
- Seed data counts (roles, policies, email templates)

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "connection refused" | PostgreSQL not ready | Ensure `postgres` service is healthy before running migrations |
| "schema already exists" | Schema created multiple times | Safe to ignore - `CREATE SCHEMA IF NOT EXISTS` handles this |
| "type already exists" | Enum types in auth from previous partial run | Reset database: `DROP SCHEMA auth CASCADE` |
| Migration hangs | Network issue to Sentinel repo | Check internet access, verify `SENTINEL_VERSION` is valid |
| Seed data errors | Template already exists | Safe to ignore - idempotent inserts |

### Reset Procedure

For complete reset in development:

```bash
# Full reset
docker compose down -v  # This removes volumes including databases
docker compose up -d    # This will re-run init scripts and migrations
```

## Version Compatibility

- **Sentinel v1.1.0**: Current target version
- **PostgreSQL**: 16+ (tested with 16-alpine)
- **Diesel**: Used for migration tracking schema

## Future Improvements

1. **Migration Version Pinning**: Lock to specific migration hash instead of just version
2. **Rollback Support**: Add down migrations capability
3. **Health Checks**: Add liveness/readiness probes
4. **Metrics**: Export migration duration and success metrics

---

*Document Version: 1.0*  
*Last Updated: May 2026*