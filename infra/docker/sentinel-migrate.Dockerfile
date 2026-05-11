# Sentinel Migration Service
# Runs Diesel migrations against the 'auth' schema in the shared moshsplit database
FROM rust:1.91-slim

RUN apt-get update && apt-get install -y \
    libpq-dev \
    pkg-config \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install diesel_cli
RUN cargo install diesel_cli --no-default-features --features postgres

WORKDIR /app

# Clone Sentinel repo to get migrations
# This is needed because the pre-built image doesn't include migrations
RUN git clone --depth 1 https://github.com/graned/sentinel.git /tmp/sentinel && \
    cp -r /tmp/sentinel/apps/sentinel-core/migrations /tmp/sentinel_migrations

# Create the auth schema migration (run first to create the schema)
RUN mkdir -p /app/migrations && \
    echo '-- Create the auth schema used by Sentinel tables' > /app/migrations/0000_create_auth_schema.up.sql && \
    echo 'CREATE SCHEMA IF NOT EXISTS auth;' >> /app/migrations/0000_create_auth_schema.up.sql && \
    echo '-- Drop auth schema (for down migration)' > /app/migrations/0000_create_auth_schema.down.sql && \
    echo 'DROP SCHEMA IF EXISTS auth CASCADE;' >> /app/migrations/0000_create_auth_schema.down.sql

# Copy the rest of the Sentinel migrations (renaming to ensure they run after our schema creation)
RUN cp -r /tmp/sentinel_migrations/* /app/migrations/ && \
    cd /app/migrations && for dir in */; do mv "$dir" "1${dir}"; done

# Create diesel.toml that configures the 'auth' schema
# This tells Diesel to run migrations against the 'auth' schema instead of 'public'
RUN echo '[print_schema]' >> /app/diesel.toml && \
    echo 'file = "schema.rs"' >> /app/diesel.toml && \
    echo '' >> /app/diesel.toml && \
    echo '# The PostgreSQL schema to use for migrations' >> /app/diesel.toml && \
    echo 'schema = "auth"' >> /app/diesel.toml && \
    echo '' >> /app/diesel.toml && \
    echo '[migrations_directory]' >> /app/diesel.toml && \
    echo 'dir = "migrations/"' >> /app/diesel.toml

CMD ["sh", "-c", "cd /app && diesel setup && diesel migration run"]