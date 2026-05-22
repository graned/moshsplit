-- =============================================================================
-- MoshSplit — PostgreSQL Initialisation
-- =============================================================================
-- Single database, multiple schemas:
--   - moshsplit database: app schema (pitboss-api)
--   - sentinel_auth database: auth schema (Sentinel)
--
-- Idempotent — safe to run multiple times.
-- =============================================================================

-- ── Roles (idempotent) ───────────────────────────────────────────────────────

-- pitboss: used by the pitboss-api service (Rust / Axum)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pitboss') THEN
        CREATE ROLE pitboss LOGIN PASSWORD 'password';
    END IF;
END
$$;

-- sentinel: used by the Sentinel auth service
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sentinel') THEN
        CREATE ROLE sentinel LOGIN PASSWORD 'sentinel_dev';
    END IF;
END
$$;

-- Create sentinel_auth database if not exists
SELECT 'CREATE DATABASE sentinel_auth' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sentinel_auth')\gexec

-- ── Schemas in moshsplit database ─────────────────────────────────────────────

\c moshsplit

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION postgres;

-- ── Schemas in sentinel_auth database ─────────────────────────────────────────

\c sentinel_auth

-- Create auth schema first
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION postgres;

-- Create pgcrypto extension in public schema (needed for gen_random_uuid, crypt, gen_salt)
-- NOTE: Migrations run as postgres with default search_path including public.
--       Sentinel runtime uses search_path=auth,public so it can also find these.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Grant execute on pgcrypto functions to sentinel
GRANT EXECUTE ON FUNCTION public.crypt(text, text) TO sentinel;
GRANT EXECUTE ON FUNCTION public.gen_salt(text) TO sentinel;
GRANT EXECUTE ON FUNCTION public.gen_salt(text, integer) TO sentinel;
GRANT EXECUTE ON FUNCTION public.gen_random_uuid() TO sentinel;

-- ── Grants in moshsplit database ──────────────────────────────────────────────

\c moshsplit

-- === app schema → pitboss ===
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

-- Default search_path for pitboss
ALTER ROLE pitboss SET search_path TO app, public;

-- Diesel stores __diesel_schema_migrations in public
GRANT ALL ON SCHEMA public TO pitboss;
GRANT ALL ON SCHEMA public TO postgres;

-- ── Grants in sentinel_auth database ──────────────────────────────────────────

\c sentinel_auth

-- === auth schema → sentinel ===
GRANT USAGE ON SCHEMA auth TO sentinel;
GRANT CREATE ON SCHEMA auth TO sentinel;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
    GRANT ALL PRIVILEGES ON TABLES    TO sentinel;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
    GRANT ALL PRIVILEGES ON SEQUENCES TO sentinel;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth
    GRANT ALL PRIVILEGES ON FUNCTIONS TO sentinel;

GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA auth TO sentinel;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO sentinel;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA auth TO sentinel;

-- Set default search_path for sentinel (public needed for pgcrypto functions)
ALTER ROLE sentinel SET search_path TO auth, public;

-- Return to postgres database
\c postgres
