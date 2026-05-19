# syntax=docker/dockerfile:1
#
# MoshSplit — pitboss-api Dockerfile
# ====================================
# Multi-stage: `dev` for development (hot-reload via cargo-watch),
#              `prod` for production (optimised release build on slim runtime).

# ── Dev stage ────────────────────────────────────────────────────────────────
FROM rust:1.91-slim AS dev

# Install build dependencies and hot-reload utility
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libpq-dev \
    curl \
    && cargo install cargo-watch \
    && rm -rf /var/lib/apt/lists/*

# Copy entire monorepo to preserve relative paths
WORKDIR /moshsplit
COPY . .

# Run from the actual pitboss-api directory
WORKDIR /moshsplit/apps/pitboss-api

EXPOSE 8080

# `cargo watch` polls the filesystem and re-runs on every change.
CMD ["cargo", "watch", "-x", "run"]


# ── Production builder ───────────────────────────────────────────────────────
FROM rust:1.91-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy entire monorepo to preserve relative paths
WORKDIR /moshsplit
COPY . .

# Build from the actual pitboss-api directory (preserves relative paths in Cargo.toml)
WORKDIR /moshsplit/apps/pitboss-api
RUN cargo build --release


# ── Production runtime ───────────────────────────────────────────────────────
FROM debian:bookworm-slim AS prod

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage.
COPY --from=builder /moshsplit/apps/pitboss-api/target/release/pitboss-api /usr/local/bin/pitboss-api

ENTRYPOINT ["pitboss-api"]

EXPOSE 8080
