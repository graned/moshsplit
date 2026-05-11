# syntax=docker/dockerfile:1
#
# MoshSplit — web (React PWA) Dockerfile
# ========================================
# Multi-stage: `dev` (Vite HMR via pnpm) and `prod` (static build served by nginx).
# Environment variables VITE_* are baked into the JS bundle at build time.


# ── Dev stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace files so pnpm can resolve the monorepo layout.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /app/

# Copy package sources
COPY apps/web/package.json /app/apps/web/
COPY packages/sentinel-sdk/package.json /app/packages/sentinel-sdk/
COPY packages/sentinel-sdk/src /app/packages/sentinel-sdk/src/
COPY packages/sentinel-sdk/tsconfig.json /app/packages/sentinel-sdk/
COPY packages/sentinel-sdk/tsconfig.cjs.json /app/packages/sentinel-sdk/

# Install dependencies (workspace-aware).
RUN pnpm install --frozen-lockfile

# Build sentinel-sdk (TypeScript -> JS)
RUN pnpm --filter @moshsplit/sentinel-sdk build

# Copy the rest of the web app source.  In dev the entire apps/web/
# directory is typically mounted as a volume for live HMR.
COPY apps/web/ /app/apps/web/

# Set environment variables for Vite (can be overridden at runtime via -e flag)
# VITE_API_BASE_URL: URL for pitboss-api (used for API calls / direct URL in prod)
# VITE_SENTINEL_URL: URL for Sentinel auth service
ENV VITE_API_BASE_URL=http://pitboss-api:8080
ENV VITE_SENTINEL_URL=http://sentinel:8000

EXPOSE 5173

# Vite dev server with host set to 0.0.0.0 so the container is reachable.
# Note: In dev mode, configure Vite proxy in vite.config.ts to forward /api/* to pitboss-api
CMD ["pnpm", "--filter", "web", "dev", "--host", "0.0.0.0"]


# ── Production builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /app/
COPY apps/web/package.json /app/apps/web/
RUN pnpm install --frozen-lockfile

COPY apps/web/ /app/apps/web/

# Environment variables for production build - these will be baked into the bundle
ARG VITE_API_BASE_URL=http://pitboss-api:8080
ARG VITE_SENTINEL_URL=http://sentinel:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SENTINEL_URL=${VITE_SENTINEL_URL}

RUN pnpm --filter web build


# ── Production runtime ───────────────────────────────────────────────────────
FROM nginx:alpine AS prod

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
