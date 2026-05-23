# Feature Request: Official Migration & Setup Docker Images

## Is your feature request related to a problem? Please describe.

Setting up Sentinel for the first time requires multiple manual steps:

1. Creating the database and schema manually
2. Setting up roles and permissions
3. Creating the `pgcrypto` extension
4. Running Diesel migrations using a custom Dockerfile
5. Configuring environment variables correctly

For production deployments and CI/CD pipelines, this adds complexity and potential for errors. Currently, users need to:

- Clone the Sentinel repository just to access migrations
- Build custom migration Dockerfiles
- Write their own initialization scripts
- Handle schema/permission setup manually

## Describe the solution you'd like

### 1. Official Migration Docker Image

Publish a pre-built migration image to GHCR:

```bash
# Pull and run migrations
docker pull ghcr.io/graned/sentinel-migrate:v1.3.0
docker run --rm \
  -e DATABASE_URL="postgres://..." \
  ghcr.io/graned/sentinel-migrate:v1.3.0
```

**Benefits:**
- No need to clone repo or build locally
- Works in air-gapped environments (once pulled)
- Consistent across deployments
- Versioned alongside Sentinel releases

### 2. Official Setup/Init Image

A comprehensive setup image that handles initial database preparation:

```bash
# Complete setup (database + schema + migrations)
docker pull ghcr.io/graned/sentinel-setup:v1.3.0
docker run --rm \
  -e DATABASE_URL="postgres://..." \
  -e CREATE_DATABASE=true \
  -e CREATE_SCHEMA=true \
  -e RUN_MIGRATIONS=true \
  ghcr.io/graned/sentinel-setup:v1.3.0
```

**Features:**
- Create database (if not exists)
- Create `auth` schema
- Create required roles
- Grant permissions
- Create `pgcrypto` extension
- Run all migrations

### 3. Docker Compose Integration

Provide an official `docker-compose.migrations.yml`:

```yaml
services:
  sentinel-migrations:
    image: ghcr.io/graned/sentinel-migrate:v1.3.0
    environment:
      DATABASE_URL: ${DATABASE_URL}
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"
```

**Usage:**
```bash
docker compose -f docker-compose.yml -f docker-compose.migrations.yml up
```

### 4. Init Container Pattern

Support for Kubernetes-style init containers in the main compose file:

```yaml
services:
  sentinel:
    image: ghcr.io/graned/sentinel-core:v1.3.0
    depends_on:
      migrations:
        condition: service_completed_successfully
  
  migrations:
    image: ghcr.io/graned/sentinel-migrate:v1.3.0
    environment:
      DATABASE_URL: ${DATABASE_URL}
```

## Describe alternatives you've considered

Currently using a custom setup script that:
1. Clones Sentinel repo to `/tmp/sentinel`
2. Builds a custom Dockerfile with migrations
3. Runs migrations in a container
4. Cleans up temporary files

This works but is:
- ❌ Slower (clone + build every time)
- ❌ Less reliable (Git repo might be unavailable)
- ❌ Harder to version (tied to script, not Sentinel version)
- ❌ More complex (multiple steps, potential failure points)

## Additional context

### Current Workflow Example

What users have to do now:

```bash
# Clone repo
git clone https://github.com/graned/sentinel.git /tmp/sentinel
cd /tmp/sentinel

# Create custom Dockerfile
cat > Dockerfile.migrate << 'EOF'
FROM rust:1.91-slim
RUN apt-get update && apt-get install -y libpq-dev pkg-config
RUN cargo install diesel_cli --no-default-features --features postgres
COPY apps/sentinel-core/migrations /app/migrations
WORKDIR /app
CMD ["diesel", "migration", "run"]
EOF

# Build and run
docker build -t sentinel-migrate .
docker run --rm -e DATABASE_URL="..." sentinel-migrate
```

### Desired Workflow

What it should be:

```bash
# One command with official image
docker run --rm \
  -e DATABASE_URL="..." \
  ghcr.io/graned/sentinel-migrate:v1.3.0
```

### Version Matrix

| Sentinel Version | Migration Image | Setup Image |
|-----------------|-----------------|-------------|
| v1.3.0 | `ghcr.io/graned/sentinel-migrate:v1.3.0` | `ghcr.io/graned/sentinel-setup:v1.3.0` |
| v1.2.0 | `ghcr.io/graned/sentinel-migrate:v1.2.0` | `ghcr.io/graned/sentinel-setup:v1.2.0` |
| latest | `ghcr.io/graned/sentinel-migrate:latest` | `ghcr.io/graned/sentinel-setup:latest` |

## Implementation Suggestions

### For Migration Image

```dockerfile
FROM rust:1.91-slim AS builder
RUN apt-get update && apt-get install -y libpq-dev pkg-config
RUN cargo install diesel_cli --no-default-features --features postgres

FROM rust:1.91-slim
RUN apt-get update && apt-get install -y --no-install-recommends libpq5
COPY --from=builder /usr/local/cargo/bin/diesel /usr/local/bin/diesel
COPY apps/sentinel-core/migrations /app/migrations
WORKDIR /app
CMD ["diesel", "migration", "run"]
```

### For Setup Image

```dockerfile
FROM postgres:16-alpine
RUN apk add --no-cache bash
COPY scripts/setup-schema.sh /setup.sh
COPY apps/sentinel-core/migrations /migrations
CMD ["/setup.sh"]
```

### GitHub Actions Workflow

```yaml
name: Build and Push Migration Images

on:
  release:
    types: [published]
  push:
    tags:
      - 'v*'

jobs:
  build-migrate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.migrate
          push: true
          tags: |
            ghcr.io/graned/sentinel-migrate:${{ github.ref_name }}
            ghcr.io/graned/sentinel-migrate:latest
```

## Benefits for the Community

1. **Easier Onboarding** - New users can get started in minutes
2. **Production Ready** - Official images are tested and versioned
3. **CI/CD Friendly** - Easy to integrate into deployment pipelines
4. **Kubernetes Ready** - Supports init container pattern
5. **Consistency** - Same setup process everywhere (dev, staging, prod)
6. **Documentation** - Clear, official setup instructions

## Would you be willing to contribute?

I'd be happy to help with:
- [ ] Creating the Dockerfiles
- [ ] Writing GitHub Actions workflows
- [ ] Testing the images
- [ ] Writing documentation
- [ ] Contributing to the setup scripts
