# syntax=docker/dockerfile:1
#
# MoshSplit — spin (Test External Login App) Dockerfile
# Multi-stage: builder and nginx runtime

# ── Builder stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9.15.4

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc /app/
COPY apps/test-external-login/package.json /app/apps/test-external-login/
COPY packages/sentinel-sdk/package.json /app/packages/sentinel-sdk/
COPY packages/sentinel-auth-react/package.json /app/packages/sentinel-auth-react/

RUN pnpm install --frozen-lockfile

COPY packages/sentinel-sdk/ /app/packages/sentinel-sdk/
COPY packages/sentinel-auth-react/ /app/packages/sentinel-auth-react/
COPY apps/test-external-login/ /app/apps/test-external-login/

RUN pnpm --filter @moshsplit/sentinel-sdk build
RUN pnpm --filter @moshsplit/auth-react build
RUN pnpm --filter @moshsplit/test-external-login build


# ── Production runtime ────────────────────────────────────────────────────────
FROM nginx:alpine AS prod

COPY --from=builder /app/apps/test-external-login/dist /usr/share/nginx/html
COPY apps/test-external-login/public/config.js /usr/share/nginx/html/config.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
