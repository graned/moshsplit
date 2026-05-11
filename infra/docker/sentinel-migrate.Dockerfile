# Sentinel Migration Service
# Runs Diesel migrations against the 'public' schema in the shared moshsplit database
# Note: Pre-built Sentinel binary expects tables in 'public' schema
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

# Create migrations directory and copy Sentinel migrations
RUN mkdir -p /app/migrations && cp -r /tmp/sentinel_migrations/* /app/migrations/

# Create diesel.toml that uses the default 'public' schema
# This matches what the pre-built Sentinel binary expects
RUN echo '[print_schema]' >> /app/diesel.toml && \
    echo 'file = "schema.rs"' >> /app/diesel.toml && \
    echo '' >> /app/diesel.toml && \
    echo '# The PostgreSQL schema to use for migrations (default is public)' >> /app/diesel.toml && \
    echo '# Using default public schema to match pre-built Sentinel binary' >> /app/diesel.toml && \
    echo '' >> /app/diesel.toml && \
    echo '[migrations_directory]' >> /app/diesel.toml && \
    echo 'dir = "migrations/"' >> /app/diesel.toml

CMD ["sh", "-c", "echo '=== Starting Diesel Setup ===' && cd /app && PGOPTIONS='-c search_path=public' diesel setup && echo '=== Running Migrations ===' && PGOPTIONS='-c search_path=public' diesel migration run 2>&1"]