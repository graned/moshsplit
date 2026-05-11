## Current Project Status

### Integration Tests
- **62 tests passing** in pitboss-api (tests against real Docker API)
- **15 tests passing** in sentinel-client SDK (unit + integration tests)

### Sentinel SDK (Rust)
- `packages/sentinel-client/` - Rust SDK for Sentinel Auth
- Tests: `tests/integration.rs` (6 tests), `tests/middleware.rs` (6 tests)
- All tests pass against Sentinel at localhost:9000

### Architecture
- **Repositories**: `domain/repositories` (moved from infrastructure/persistence)
- **Auth**: Using sentinel-client SDK for token validation middleware
- **Currency**: EUR (default)

### Running Tests
```bash
# Pitboss API tests
cd apps/pitboss-api && cargo test

# Sentinel client tests
cd packages/sentinel-client && cargo test --tests
```

### Recent Commits
- Add integration and middleware tests for sentinel-client SDK
- Create Rust sentinel-client SDK
- Move repositories to domain/repositories
- Add 22 validation tests (P0/P1)
- Fix list endpoint response format