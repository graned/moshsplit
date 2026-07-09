# syntax=docker/dockerfile:1
#
# MoshSplit — test-external-login Dockerfile
# Multi-stage build for test-external-login app

# ── Builder stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.15.4

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /app/

# Copy package manifests for workspace resolution
COPY apps/test-external-login/package.json /app/apps/test-external-login/
COPY packages/sentinel-sdk/package.json /app/packages/sentinel-sdk/
COPY packages/sentinel-auth-react/package.json /app/packages/sentinel-auth-react/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy package sources
COPY packages/sentinel-sdk/ /app/packages/sentinel-sdk/
COPY packages/sentinel-auth-react/ /app/packages/sentinel-auth-react/

# Copy app source
COPY apps/test-external-login/ /app/apps/test-external-login/

# Build packages first
RUN pnpm --filter @moshsplit/sentinel-sdk build
RUN pnpm --filter @moshsplit/auth-react build

# Build the app (pass Vite env vars at build time)
ARG VITE_API_URL=http://localhost:8080
ARG VITE_API_TOKEN=
ARG VITE_SENTINEL_URL=/sentinel
ARG VITE_MOSHSPLIT_URL=http://moshsplit.localhost
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_TOKEN=$VITE_API_TOKEN
ENV VITE_SENTINEL_URL=$VITE_SENTINEL_URL
ENV VITE_MOSHSPLIT_URL=$VITE_MOSHSPLIT_URL
RUN pnpm --filter @moshsplit/test-external-login build


# ── Production runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Install serve to serve static files
RUN npm install -g serve

# Copy built assets
COPY --from=builder /app/apps/test-external-login/dist /app/dist

# Environment variables
ENV VITE_API_URL=http://localhost:8080
ENV VITE_API_TOKEN=
ENV VITE_SENTINEL_URL=http://localhost:9000
ENV VITE_MOSHSPLIT_URL=http://moshsplit.localhost
ENV PORT=5174

EXPOSE 5174

CMD ["serve", "-s", "/app/dist", "-l", "5174"]
