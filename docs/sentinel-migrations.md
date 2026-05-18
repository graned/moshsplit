# Sentinel Database Migration Guide

## Overview

Sentinel migrations are now run **manually once** before deploying MoshSplit. This gives you full control over when database schema changes are applied.

## When to Run Migrations

Run migrations:
- ✅ **First-time setup** - Before initial deployment
- ✅ **Upgrading Sentinel version** - When updating from one version to another
- ✅ **Schema changes** - When Sentinel releases new migrations

**DO NOT run migrations** for routine MoshSplit app updates (only when Sentinel version changes).

---

## Migration Steps

### 1. Ensure Database is Running

```bash
# Start only PostgreSQL
docker compose -f infra/compose/prod-caddy.yml up -d postgres
```

### 2. Run Migrations

```bash
# Run sentinel-migrate container manually
docker compose -f infra/compose/prod-caddy.yml run --rm sentinel-migrate
```

**What this does:**
- Connects to your PostgreSQL database
- Applies all pending migrations
- Creates required schema (`auth`)
- Seeds initial data if needed
- Exits successfully when complete

### 3. Verify Migrations

```bash
# Check migration logs
docker compose -f infra/compose/prod-caddy.yml logs sentinel-migrate

# Expected output:
# "Migrations completed successfully"
# "Seeded initial data"
```

### 4. Deploy All Services

```bash
# Start all services
docker compose -f infra/compose/prod-caddy.yml up -d

# Check status
docker compose -f infra/compose/prod-caddy.yml ps
```

---

## First-Time Setup Example

```bash
# 1. Clone and configure
cd /opt/moshsplit
nano .env  # Set your values

# 2. Start database
docker compose -f infra/compose/prod-caddy.yml up -d postgres

# Wait for database to be healthy
docker compose -f infra/compose/prod-caddy.yml logs -f postgres

# 3. Run migrations
docker compose -f infra/compose/prod-caddy.yml run --rm sentinel-migrate

# 4. Deploy everything
docker compose -f infra/compose/prod-caddy.yml up -d

# 5. Verify
docker compose -f infra/compose/prod-caddy.yml ps
```

---

## Upgrading Sentinel

When upgrading Sentinel (e.g., v1.1.0 → v1.2.0):

```bash
# 1. Stop services
docker compose -f infra/compose/prod-caddy.yml down

# 2. Update version in .env
nano .env
# SENTINEL_VERSION=v1.2.0

# 3. Run new migrations
docker compose -f infra/compose/prod-caddy.yml run --rm sentinel-migrate

# 4. Pull new images
docker compose -f infra/compose/prod-caddy.yml pull

# 5. Deploy
docker compose -f infra/compose/prod-caddy.yml up -d
```

---

## Troubleshooting

### Migration Fails

```bash
# Check database is healthy
docker compose -f infra/compose/prod-caddy.yml ps postgres

# View detailed logs
docker compose -f infra/compose/prod-caddy.yml logs sentinel-migrate

# Check database connection
docker compose -f infra/compose/prod-caddy.yml exec postgres \
  psql -U postgres -d moshsplit -c "SELECT 1"
```

### Already Ran Migrations

If migrations already ran successfully, you'll see:
```
Migrations are up to date
Nothing to do
```

This is normal and safe - migrations are idempotent.

### Reset Migrations (⚠️ DANGER - Deletes Data)

```bash
# ONLY for development/testing!
docker compose -f infra/compose/prod-caddy.yml down -v  # Deletes all data
docker compose -f infra/compose/prod-caddy.yml up -d postgres
docker compose -f infra/compose/prod-caddy.yml run --rm sentinel-migrate
```

---

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@postgres:5432/moshsplit` |
| `SENTINEL_VERSION` | Sentinel version to migrate to | `v1.1.0` |

---

## Quick Reference

```bash
# Run migrations
docker compose -f infra/compose/prod-caddy.yml run --rm sentinel-migrate

# Check migration status
docker compose -f infra/compose/prod-caddy.yml logs sentinel-migrate

# View database schema
docker compose -f infra/compose/prod-caddy.yml exec postgres \
  psql -U postgres -d moshsplit -c "\dn"  # List schemas
```

---

## Support

For migration issues:
1. Check logs: `docker compose logs sentinel-migrate`
2. Verify database connection: `docker compose exec postgres psql -U postgres -d moshsplit`
3. Review Sentinel documentation: https://github.com/graned/sentinel
