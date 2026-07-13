-- Create additional databases
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sentinel_auth') THEN
        CREATE DATABASE sentinel_auth;
    END IF;
END
$$;