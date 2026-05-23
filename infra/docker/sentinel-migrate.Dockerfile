# =============================================================================
# Sentinel Migrations — clones Sentinel at build time, runs migrations at runtime
# =============================================================================
# Clones the repo during docker build so runtime needs no internet access.
# Accepts SENTINEL_VERSION as build arg.
#
# Build:
#   docker build -f infra/docker/sentinel-migrate.Dockerfile \
#     --build-arg SENTINEL_VERSION=v1.3.2 -t moshsplit-sentinel-migrate:v1.3.2 .
#
#   docker build -f infra/docker/sentinel-migrate.Dockerfile \
#     --build-arg SENTINEL_VERSION=v1.3.2 \
#     -t ghcr.io/graned/moshsplit/sentinel-migrate:v1.3.2 .
#
# Run (inside Docker network):
#   docker run --rm \
#     --network moshsplit_default \
#     -e DATABASE_URL="postgres://postgres:password@moshsplit-postgres-1:5432/sentinel_auth" \
#     moshsplit-sentinel-migrate:v1.3.2

ARG SENTINEL_VERSION=v1.3.2
FROM rust:1.82-slim AS builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch ${SENTINEL_VERSION} \
    https://github.com/graned/sentinel.git /tmp/sentinel

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

COPY --from=builder /tmp/sentinel/apps/sentinel-core/migrations /migrations

COPY infra/docker/sentinel-migrate-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /migrations
ENTRYPOINT ["/entrypoint.sh"]