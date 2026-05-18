# syntax=docker/dockerfile:1
#
# MoshSplit — pitboss-api Dockerfile
# ====================================
# Multi-stage: `dev` for development (hot-reload via cargo-watch),
#              `prod` for production (optimised release build on slim runtime).

# ── Dev stage ────────────────────────────────────────────────────────────────
FROM rust:1.91-slim AS dev

WORKDIR /app

# Install build dependencies and hot-reload utility
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    curl \
    && cargo install cargo-watch \
    && rm -rf /var/lib/apt/lists/*

# Copy entire workspace
COPY . .

EXPOSE 8080

# `cargo watch` polls the filesystem and re-runs on every change.
CMD ["cargo", "watch", "-x", "run", "--manifest-path", "apps/pitboss-api/Cargo.toml"]


# ── Production builder ───────────────────────────────────────────────────────
FROM rust:1.91-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy entire workspace
COPY . .

# Build the release binary
RUN cargo build --release --manifest-path apps/pitboss-api/Cargo.toml


# ── Production runtime ───────────────────────────────────────────────────────
FROM debian:bookworm-slim AS prod

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage.
COPY --from=builder /app/target/release/pitboss-api /usr/local/bin/pitboss-api

ENTRYPOINT ["pitboss-api"]

EXPOSE 8080
