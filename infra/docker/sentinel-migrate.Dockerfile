# Sentinel Migration Service
# Runs Diesel migrations against the 'auth' schema in the sentinel_auth database
FROM rust:1.91-slim

RUN apt-get update && apt-get install -y \
    libpq-dev \
    pkg-config \
    git \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install diesel_cli
RUN cargo install diesel_cli --no-default-features --features postgres

WORKDIR /app

# Clone Sentinel repo to get migrations
# This is needed because the pre-built image doesn't include migrations
RUN git clone --depth 1 https://github.com/graned/sentinel.git /tmp/sentinel && \
    cp -r /tmp/sentinel/apps/sentinel-core/migrations /tmp/sentinel_migrations

# Create migrations directory and copy Sentinel migrations
RUN mkdir -p /app/migrations && cp -r /tmp/sentinel_migrations/* /app/migrations/

# Create diesel.toml
RUN echo '[print_schema]' >> /app/diesel.toml && \
    echo 'file = "schema.rs"' >> /app/diesel.toml && \
    echo '' >> /app/diesel.toml && \
    echo '[migrations_directory]' >> /app/diesel.toml && \
    echo 'dir = "migrations/"' >> /app/diesel.toml

CMD ["sh", "-c", "echo '=== Creating auth schema ===' && PGPASSWORD=password psql -h postgres -U postgres -d sentinel_auth -c 'CREATE SCHEMA IF NOT EXISTS auth;' && echo '=== Starting Diesel Setup ===' && cd /app && PGOPTIONS='-c search_path=public' diesel setup && echo '=== Running Migrations ===' && PGOPTIONS='-c search_path=public' diesel migration run && echo '=== Moving tables to auth schema ===' && PGPASSWORD=password psql -h postgres -U postgres -d sentinel_auth -c \"ALTER TABLE public.users SET SCHEMA auth; ALTER TABLE public.user_identities SET SCHEMA auth; ALTER TABLE public.sessions SET SCHEMA auth; ALTER TABLE public.email_verifications SET SCHEMA auth; ALTER TABLE public.auth_configs SET SCHEMA auth; ALTER TABLE public.roles SET SCHEMA auth; ALTER TABLE public.policies SET SCHEMA auth; ALTER TABLE public.policy_versions SET SCHEMA auth; ALTER TABLE public.provider_configurations SET SCHEMA auth; ALTER TABLE public.oidc_signing_keys SET SCHEMA auth; ALTER TABLE public.oidc_clients SET SCHEMA auth; ALTER TABLE public.oidc_auth_codes SET SCHEMA auth; ALTER TABLE public.password_reset_tokens SET SCHEMA auth; ALTER TABLE public.email_templates SET SCHEMA auth; ALTER TABLE public.user_mfa_totp SET SCHEMA auth; ALTER TABLE public.user_recovery_codes SET SCHEMA auth; ALTER TABLE public.user_roles SET SCHEMA auth; ALTER TABLE public.api_tokens SET SCHEMA auth; ALTER TABLE public.__diesel_schema_migrations SET SCHEMA auth;\" 2>&1"]