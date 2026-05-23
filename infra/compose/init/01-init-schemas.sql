-- MoshSplit — PostgreSQL Initialisation (moshsplit database only)
-- Creates moshsplit database, app schema, pitboss role, and pgcrypto extension.
-- Idempotent — safe to run multiple times.

-- ── moshsplit database ─────────────────────────────────────────────────────────
CREATE DATABASE moshsplit;

-- ── app schema ─────────────────────────────────────────────────────────────────
\c moshsplit
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION postgres;

-- ── pitboss role ───────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pitboss') THEN
        CREATE ROLE pitboss LOGIN PASSWORD 'password';
    END IF;
END
$$;

-- ── pgcrypto extension ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ── app schema grants → pitboss ────────────────────────────────────────────────
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

-- ── pgcrypto grants → pitboss ─────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.crypt(text, text) TO pitboss;
GRANT EXECUTE ON FUNCTION public.gen_salt(text) TO pitboss;
GRANT EXECUTE ON FUNCTION public.gen_salt(text, integer) TO pitboss;
GRANT EXECUTE ON FUNCTION public.gen_random_uuid() TO pitboss;

\c postgres