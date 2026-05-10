# syntax=docker/dockerfile:1
#
# MoshSplit — pitboss-api Dockerfile
# ====================================
# Multi-stage: `dev` for development (hot-reload via cargo-watch),
#              `prod` for production (optimised release build on slim runtime).

# ── Dev stage ────────────────────────────────────────────────────────────────
FROM rust:latest AS dev

WORKDIR /app

# Install hot-reload utility
RUN cargo install cargo-watch

# ── Dependency caching ───────────────────────────────────────────────────────
# Copy manifest files first so Docker can cache dependency layers.
COPY apps/pitboss-api/Cargo.toml apps/pitboss-api/Cargo.lock* /app/

# Create a dummy main.rs so `cargo build` can resolve and cache dependencies.
# This layer is reused unless Cargo.toml / Cargo.lock changes.
RUN mkdir -p /app/src && echo "fn main() {}" > /app/src/main.rs
RUN cargo build --release 2>/dev/null || true

# Copy real source (overrides dummy main.rs). In dev the src/ directory
# is typically mounted as a volume for live editing; this COPY is the
# fallback so the image is self-contained.
COPY apps/pitboss-api/src/ /app/src/

EXPOSE 8080

# `cargo watch` polls the filesystem and re-runs on every change.
CMD ["cargo", "watch", "-x", "run"]


# ── Production builder ───────────────────────────────────────────────────────
FROM rust:latest AS builder

WORKDIR /app

# Same dependency-caching pattern as the dev stage.
COPY apps/pitboss-api/Cargo.toml apps/pitboss-api/Cargo.lock* /app/
RUN mkdir -p /app/src && echo "fn main() {}" > /app/src/main.rs
RUN cargo build --release 2>/dev/null || true

# Copy the full source and build the release binary.
COPY apps/pitboss-api/ /app/
RUN cargo build --release --locked


# ── Production runtime ───────────────────────────────────────────────────────
FROM debian:bookworm-slim AS prod

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage.
COPY --from=builder /app/target/release/pitboss-api /usr/local/bin/pitboss-api

ENTRYPOINT ["pitboss-api"]

EXPOSE 8080
