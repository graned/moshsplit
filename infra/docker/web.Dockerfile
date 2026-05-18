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
COPY packages/sentinel-auth-react/package.json /app/packages/sentinel-auth-react/
COPY packages/sentinel-auth-react/src /app/packages/sentinel-auth-react/src/
COPY packages/sentinel-auth-react/tsconfig.json /app/packages/sentinel-auth-react/
COPY packages/sentinel-auth-react/vite.config.ts /app/packages/sentinel-auth-react/

# Install dependencies (workspace-aware).
RUN pnpm install --frozen-lockfile

# Build packages (TypeScript -> JS)
RUN pnpm --filter @moshsplit/sentinel-sdk build
RUN pnpm --filter @moshsplit/auth-react build

# Copy the rest of the web app source.  In dev the entire apps/web/
# directory is typically mounted as a volume for live HMR.
COPY apps/web/ /app/apps/web/

# Set environment variables for Vite (can be overridden at runtime via -e flag)
# VITE_API_BASE_URL: URL for pitboss-api (relative path for Caddy, full URL for direct)
# VITE_SENTINEL_URL: URL for Sentinel auth service
# Note: In dev mode, Vite proxy handles routing to local services
ENV VITE_API_BASE_URL=/pitboss
ENV VITE_SENTINEL_URL=/sentinel

EXPOSE 5173

# Vite dev server with host set to 0.0.0.0 so the container is reachable.
# Note: In dev mode, configure Vite proxy in vite.config.ts to forward /api/* to pitboss-api
CMD ["pnpm", "--filter", "web", "dev", "--host", "0.0.0.0"]


# ── Production builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /app/

# Copy all package manifests for workspace resolution
COPY apps/web/package.json /app/apps/web/
COPY packages/sentinel-sdk/package.json /app/packages/sentinel-sdk/
COPY packages/sentinel-auth-react/package.json /app/packages/sentinel-auth-react/

# Install dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile

# Copy package sources (needed for TypeScript build)
COPY packages/sentinel-sdk/ /app/packages/sentinel-sdk/
COPY packages/sentinel-auth-react/ /app/packages/sentinel-auth-react/

# Copy web app source
COPY apps/web/ /app/apps/web/

# Environment variables for production build - these will be baked into the bundle
# For Caddy deployment, use relative paths (all services same-origin)
# For direct deployment, use full URLs (e.g., http://pitboss-api:8080)
ARG VITE_API_BASE_URL=/pitboss
ARG VITE_SENTINEL_URL=/sentinel
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SENTINEL_URL=${VITE_SENTINEL_URL}

# Build packages first (TypeScript -> JS)
RUN pnpm --filter @moshsplit/sentinel-sdk build
RUN pnpm --filter @moshsplit/auth-react build

# Build web app
RUN pnpm --filter web build


# ── Production runtime ───────────────────────────────────────────────────────
FROM nginx:alpine AS prod

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
