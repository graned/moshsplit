-- =============================================================================
-- MoshSplit — PostgreSQL Initialisation
-- =============================================================================
-- This script runs once on first container start via
-- docker-entrypoint-initdb.d.  It creates the application schemas,
-- application roles, and grants appropriate permissions.
--
-- Idempotent — safe to run multiple times.
-- =============================================================================

-- ── Roles (idempotent) ───────────────────────────────────────────────────────

-- pitboss: used by the pitboss-api service (Rust / Axum)
-- Password: override via environment variable PITBOSS_PASSWORD at deployment.
--           Dev default: password
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pitboss') THEN
        CREATE ROLE pitboss LOGIN PASSWORD 'password';
    END IF;
END
$$;

-- sentinel_user: used by the Sentinel auth service (Rust / Axum)
-- Password: override via environment variable SENTINEL_PASSWORD at deployment.
--           Dev default: sentinel_dev
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sentinel_user') THEN
        CREATE ROLE sentinel_user LOGIN PASSWORD 'sentinel_dev';
    END IF;
END
$$;

-- ── Schemas (idempotent) ─────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION postgres;
CREATE SCHEMA IF NOT EXISTS app  AUTHORIZATION postgres;

-- ── Schema permissions ───────────────────────────────────────────────────────

-- === auth schema → sentinel_user ===
-- The auth schema is managed by Sentinel (Diesel migrations).
GRANT USAGE ON SCHEMA auth TO sentinel_user;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
    GRANT ALL PRIVILEGES ON TABLES    TO sentinel_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
    GRANT ALL PRIVILEGES ON SEQUENCES TO sentinel_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
    GRANT ALL PRIVILEGES ON FUNCTIONS TO sentinel_user;

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA auth TO sentinel_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO sentinel_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA auth TO sentinel_user;

-- === app schema → pitboss ===
-- The app schema is managed by pitboss-api (Diesel migrations).
GRANT USAGE ON SCHEMA app TO pitboss;
GRANT CREATE ON SCHEMA app TO pitboss;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
    GRANT ALL PRIVILEGES ON TABLES    TO pitboss;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
    GRANT ALL PRIVILEGES ON SEQUENCES TO pitboss;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app
    GRANT ALL PRIVILEGES ON FUNCTIONS TO pitboss;

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA app TO pitboss;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO pitboss;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO pitboss;

-- ── Default search_path for roles ────────────────────────────────────────────
-- Ensures bare table references resolve in the correct order.
ALTER ROLE postgres SET search_path TO app, auth, public;
ALTER ROLE pitboss  SET search_path TO app, public;

-- Diesel stores its __diesel_schema_migrations tracking table in public.
GRANT ALL ON SCHEMA public TO pitboss;
