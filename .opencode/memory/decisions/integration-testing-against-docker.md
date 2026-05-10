# Integration Testing Against Docker

## Decision

Integration tests make real HTTP calls against a running Docker container
(`docker compose up`), not in-process mock servers.

## Rationale

Real API calls validate the full middleware stack exactly as in production:
- CORS headers and configuration
- Request ID propagation and tracing
- Response wrapper serialization and envelope format
- Error handling and problem details response format
- HTTP protocol behavior and network layer semantics

Using in-process mock servers bypasses critical components of the production
deployment. Real Docker deployment tests ensure contracts match what will
actually run.

## Rule

- Test files in `tests/` use `reqwest` to make real HTTP requests
- Default target: `http://localhost:8080`
- Configurable via: `${PITBOSS_API_URL:-http://localhost:8080}`

## When to Make Exceptions

Unit tests for domain logic can use regular Rust test patterns. These do not
need a running server:
- Pure calculation and business logic
- Domain entity validation
- Parsing, serialization (when testing library code directly)
- Anything not requiring the HTTP middleware stack

## Consequences

- Local `cargo test` requires Docker daemon to be running
- CI pipeline must start services via `docker compose up -d` before test phase
- Tests for health endpoints (`/livez`, `/readyz`) don't require Postgres
- Full integration tests require both `pitboss-api` and `postgres` services
