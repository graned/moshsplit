# syntax=docker/dockerfile:1
#
# MoshSplit — web (React PWA) Dockerfile
# ========================================
# Scaffold only — the web app is not fully implemented yet.
# Multi-stage: `dev` (Vite HMR via pnpm) and `prod` (static build served by nginx).


# ── Dev stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace files so pnpm can resolve the monorepo layout.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /app/

# Copy the web app manifest.
COPY apps/web/package.json /app/apps/web/

# Install dependencies (workspace-aware).
RUN pnpm install --frozen-lockfile

# Copy the rest of the web app source.  In dev the entire apps/web/
# directory is typically mounted as a volume for live HMR.
COPY apps/web/ /app/apps/web/

EXPOSE 5173

# Vite dev server with host set to 0.0.0.0 so the container is reachable.
CMD ["pnpm", "--filter", "web", "dev", "--host", "0.0.0.0"]


# ── Production builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /app/
COPY apps/web/package.json /app/apps/web/
RUN pnpm install --frozen-lockfile

COPY apps/web/ /app/apps/web/
RUN pnpm --filter web build


# ── Production runtime ───────────────────────────────────────────────────────
FROM nginx:alpine AS prod

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
