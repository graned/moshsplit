## Integration Testing

Tests run against a real Docker-deployed API, not in-process mock servers.
- Use `docker compose -f infra/compose/dev.yml up -d` to start services
- Run `cargo test` to hit the live API at `http://localhost:8080`
- Health/livez endpoints don't need Postgres; other tests will need `postgres` service up
- Unit tests for domain logic use standard Rust patterns (no server needed)
