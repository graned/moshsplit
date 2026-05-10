## Current Project Status

### Integration Tests
- **62 tests passing** against real Docker-deployed API
- Tests run against `http://localhost:8080`
- All major endpoints covered: events, members, expenses, payments, settlements, balances, health
- Run with: `cargo test` in `apps/pitboss-api`

### API Implementation
- Full REST API implemented with Axum
- All 27 REST endpoints documented via OpenAPI/Swagger at `/swagger-ui/`
- Expense versioning, balance computation with greedy debt simplification
- Settlement workflow (pending → confirmed/disputed)

### Key Configuration
- **Currency defaults to EUR** (not USD)
- DELETE endpoints return 204 No Content
- Empty name validation on event creation
- paid_by must be one of the split members

### Running Tests
```bash
# Start Docker services first
docker compose -f infra/compose/dev.yml up -d

# Run integration tests
cd apps/pitboss-api
cargo test
```

### Recent Commits
- Fix expense split bug (extract_member_ids)
- Add 22 validation tests (P0/P1)
- Fix list endpoint response format
- Add empty name and non-member payer validation
- Change default currency to EUR