# MoshSplit Security Architecture

> **Status**: Draft  
> **Last Updated**: 2026-05-10  
> **See also**: [Overview](./overview.md) · [Data Model](./data-model.md) · [API Design](./api-design.md)  
> **External**: [Sentinel Integration Guide](../integrations/sentinel-integration-guide.md)

---

## 1. Security Philosophy

MoshSplit follows a **zero-trust, defense-in-depth** approach:

1. **No custom auth code** — Authentication is fully delegated to Sentinel, a dedicated vendored auth service.
2. **Schema-level isolation** — Auth data and app data live in separate PostgreSQL schemas with different connection credentials.
3. **Event membership enforcement** — Every operation is gated by active event membership.
4. **Input validation at every layer** — API gateway, Axum middleware, domain logic, and database constraints.
5. **Least privilege** — Each service component has only the permissions it needs.

---

## 2. Authentication Architecture

MoshSplit does **not** implement any authentication logic. All authentication is handled by **Sentinel**.

### 2.1 Token Flow

```
┌──────────┐     PASETO v4.local     ┌──────────────┐
│  Browser │◄────────────────────────►│   Sentinel   │
│  (PWA)   │  (login, register, etc)  │  (Port 9000) │
└────┬─────┘                          └──────────────┘
     │                                      │
     │ Bearer PASETO token                  │ Shares public key
     ▼                                      ▼
┌──────────────┐                    ┌──────────────┐
│ pitboss-api  │◄───────────────────│   Shared Key  │
│ (Port 8080)  │  Validates tokens  │   or Public   │
│              │  using public key  │   Decryption  │
└──────────────┘                    │   Key         │
                                    └──────────────┘
```

### 2.2 PASETO Token Validation in pitboss-api

pitboss-api does not issue tokens. It only **validates** PASETO tokens issued by Sentinel.

**Validation steps** (in order):

1. **Extract** token from `Authorization: Bearer <token>` header
2. **Verify** token signature/footer using Sentinel's public key (configured via `SENTINEL_PUBLIC_KEY` environment variable)
3. **Check expiry**: Reject if `exp` is in the past
4. **Check audience** (if applicable): Verify the token was issued for this service
5. **Extract claims**: `user_id`, `session_id`, `roles`, `email_verified`
6. **Inject** `AuthUser` into request extensions for downstream handlers

### 2.3 Token Contents

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "660e8400-e29b-41d4-a716-446655440001",
  "exp": 1715360000,
  "iat": 1715273600,
  "roles": ["user"],
  "email_verified": true
}
```

### 2.4 Token Refresh

Tokens have a limited lifetime (default: 1 hour for access tokens, 30 days for refresh tokens). The frontend's `AuthStore` (Zustand) manages the refresh flow:

1. TanStack Query interceptor detects `401 Unauthorized`
2. Interceptor calls Sentinel's `/v1/api/auth/token/refresh` with the refresh token
3. On success: new access token is stored, original request is retried
4. On failure: user is redirected to login

### 2.5 What pitboss-api Does NOT Do

- ❌ Does not store passwords
- ❌ Does not manage sessions
- ❌ Does not issue tokens
- ❌ Does not handle MFA
- ❌ Does not manage user profiles (reads only from Sentinel API)
- ❌ Does not have a user registration endpoint

---

## 3. Authorization Model

### 3.1 RBAC (Role-Based Access Control)

MoshSplit uses a two-level role system:

| Scope | Role | Description |
|-------|------|-------------|
| **System** (via Sentinel) | `admin` | Full system access (future: manage billing, audit logs) |
| **System** (via Sentinel) | `user` | Default authenticated user |
| **Event** (MoshSplit) | `admin` | Can modify event settings, manage members, delete expenses |
| **Event** (MoshSplit) | `member` | Can create/edit own expenses, record payments, view balances |

### 3.2 Event Membership Enforcement

Every event-scoped endpoint must verify that the requesting user is an **active event member**.

```rust
// Pseudocode — Axum middleware pattern
async fn require_event_member(
    Path(event_id): Path<Uuid>,
    AuthUser(user): AuthUser,
    State(db): State<DbPool>,
) -> Result<(), MembershipError> {
    let is_member = sqlx::query_scalar!(
        r#"SELECT EXISTS(
            SELECT 1 FROM app.event_member
            WHERE event_id = $1 AND user_id = $2 AND left_at IS NULL
        )"#,
        event_id,
        user.user_id
    )
    .fetch_one(&db)
    .await?;

    if !is_member {
        return Err(MembershipError::NotAMember);
    }
    Ok(())
}
```

**Enforcement points**:

| Endpoint | Membership | Role Check |
|----------|-----------|------------|
| `GET /v1/events` | N/A (lists user's events) | None |
| `POST /v1/events` | N/A (creates new event) | None |
| `GET /v1/events/:id` | Required | None |
| `PATCH /v1/events/:id` | Required | `admin` |
| `DELETE /v1/events/:id` | Required | `admin` |
| `POST /v1/events/:id/members` | Required | `admin` |
| `DELETE /v1/events/:id/members/:uid` | Required | `admin` |
| `POST /v1/events/:id/expenses` | Required | `member` |
| `PATCH /v1/events/:id/expenses/:eid` | Required | `member` (or `admin` always) |
| `DELETE /v1/events/:id/expenses/:eid` | Required | `admin` |
| `POST /v1/events/:id/payments` | Required | `member` |
| `POST /v1/events/:id/settlements` | Required | `member` |
| `PATCH /v1/events/:id/settlements/:sid` | Required | Involved parties only |
| `GET /v1/events/:id/balances` | Required | `member` |

### 3.3 Resource Ownership Enforcement

Some operations are restricted to the user who created the resource:

- **Edit expense**: The user who created the expense (or event `admin`) can create new versions
- **Delete expense**: Only event `admin` can soft-delete
- **Confirm settlement**: Only `from_user` or `to_user` can confirm

### 3.4 Authorization Check Sequence

For every protected operation, checks happen in order:

```
1. Authenticate (extract + validate PASETO token)
2. Authorize (is user an active event member?)
3. Authorize (does user have required role for this operation?)
4. Authorize (does user own the resource, if ownership is required?)
5. Validate input (schema + business rules)
6. Execute
```

This ensures early rejection before any business logic runs.

---

## 4. Data Isolation

### 4.1 Schema Separation

```
PostgreSQL Instance
├── auth schema (managed by Sentinel)
│   ├── users
│   ├── user_identities
│   ├── sessions
│   ├── user_mfa_totp
│   └── user_recovery_codes
│
└── app schema (managed by pitboss-api)
    ├── event
    ├── event_member
    ├── expense
    ├── expense_version
    ├── payment
    └── settlement
```

### 4.2 Database Credentials

| Service | Schema | Connection | Credentials |
|---------|--------|-----------|-------------|
| Sentinel | `auth` | Full access (read/write) | Sentinel-specific DB user |
| pitboss-api | `app` | Full access (read/write) | pitboss-specific DB user |
| pitboss-api | `auth` | **Read-only** (SELECT only) | Separate read-only DB user |

### 4.3 Cross-Schema Access Rules

pitboss-api needs to read user profiles (names, avatars) from the `auth` schema for display purposes:

```sql
-- pitboss-api connection to auth schema: read-only role
-- Only SELECT on specific columns of users and user_identities
GRANT SELECT ON auth.users TO pitboss_readonly;
GRANT SELECT (email) ON auth.user_identities TO pitboss_readonly;

-- Never: INSERT, UPDATE, DELETE on auth schema
```

Alternative (simpler): pitboss-api fetches user profile data via Sentinel's API (`GET /v1/api/user/me`) rather than direct DB access. This is the **preferred approach** as it maintains a clean service boundary.

### 4.4 Data Minimization

- pitboss-api stores only `user_id` (UUID) references, never user credentials or PII
- Event names, expense titles: no personal data
- Payment `external_ref`: stored as-is, no correlation with auth data

---

## 5. Input Validation

### 5.1 Validation Layers

```
┌─────────────────────────────┐
│         HTTP Layer          │
│  - Content-Type check       │
│  - Header validation        │
│  - Method validation        │
├─────────────────────────────┤
│       Axum Extractors       │
│  - Path parameter types     │
│  - Query parameter format   │
│  - JSON body structure      │
├─────────────────────────────┤
│       Domain Validation     │
│  - Business rules           │
│  - Cross-field constraints  │
│  - Authorization checks     │
├─────────────────────────────┤
│      Database Constraints   │
│  - NOT NULL                 │
│  - CHECK constraints        │
│  - UNIQUE constraints       │
│  - Foreign keys             │
│  - Serialized transactions  │
└─────────────────────────────┘
```

### 5.2 Key Validation Rules

| Field | Rule | Layer |
|-------|------|-------|
| `amount_cents` | Must be positive integer | JSON schema + DB CHECK |
| `amount_cents` | Must not exceed 999,999,999 (≈€10M) | Domain |
| `currency` | Must be valid ISO 4217 code | Domain |
| `email` | Must be valid email format | Forwarded to Sentinel |
| `user_id` | Must be valid UUIDv4 | Path extractor |
| `event_id` | Must be valid UUIDv4 | Path extractor |
| `split_data` | Must sum to `amount_cents` | Domain |
| `from_user` / `to_user` | Must not be equal | Domain + DB CHECK |
| `paid_by` | Must be active event member | Domain |
| Expense title | Non-empty, max 255 chars | JSON schema |
| Description | Max 2000 chars | JSON schema |

### 5.3 SQL Injection Prevention

- All database queries use **SQLx parameterized queries** (never string interpolation)
- User input is never concatenated into SQL strings
- JSONB fields are safely parameterized

### 5.4 XSS Prevention

- The API returns JSON only — no HTML rendering
- User-provided text (names, descriptions) is treated as plain text
- Frontend applies React's built-in escaping for any user content display

---

## 6. CORS Configuration

Both Sentinel and pitboss-api have CORS configured:

### Sentinel CORS

```
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://app.moshsplit.app
```

- Explicit origin whitelist only (no wildcards)
- Preflight (`OPTIONS`) handled automatically
- Headers: `Authorization`, `Content-Type`, `Idempotency-Key`, `X-Request-Id`

### pitboss-api CORS

```
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://app.moshsplit.app
```

- Same policy as Sentinel
- Additionally allows `Accept-Language` and `X-API-Version` headers

### CORS Response Headers

```http
Access-Control-Allow-Origin: https://app.moshsplit.app
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, X-Request-Id
Access-Control-Max-Age: 86400
```

---

## 7. Rate Limiting

### 7.1 pitboss-api Rate Limits

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| All endpoints | 100 requests | 1 minute | Per authenticated user |
| Balance computation (`/balances*`) | 30 requests | 1 minute | Per event |
| Expense/Payment creation | 20 requests | 1 minute | Per event |
| Bulk operations | 5 requests | 1 minute | Per event |

### 7.2 Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1715360000
```

### 7.3 Rate Limit Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Try again in 45 seconds."
  },
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "retry_after_seconds": 45
  }
}
```

### 7.4 Implementation

- **In-memory** (tokio-based sliding window) for single-instance deployments
- **Redis-backed** for multi-instance production deployments
- Rate limit state is eventually consistent and non-critical — lost limits on restart are acceptable

---

## 8. Additional Security Measures

### 8.1 Request ID & Tracing

Every request receives a unique `X-Request-Id` (UUIDv4). This is propagated:
- In the response header
- In structured logs
- In error responses (for debugging)

### 8.2 Audit Logging

All mutating operations log:
- Actor (`user_id`)
- Action (create, update, delete)
- Resource type and ID
- Before/after state (for expenses: old/new version)
- Timestamp

Logs are structured JSON for ingestion into monitoring systems.

### 8.3 HTTPS / TLS

- **Development**: HTTP (local network only)
- **Production**: TLS termination at the reverse proxy (nginx / ALB)
- HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- pitboss-api itself is not TLS-aware — it trusts the proxy

### 8.4 Security Headers (via Reverse Proxy)

```http
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 8.5 Secret Management

- **Development**: `.env` file (gitignored)
- **Production**: Environment variables from secure orchestration (Pulumi secrets / AWS Secrets Manager)
- No secrets in code, no secrets in Docker images
- Sentinel's `HEX_KEY` and `CONFIG_ENCRYPTION_KEY` are 32-byte hex strings generated once

### 8.6 Dependency Security

- Rust dependencies audited with `cargo audit` (CI gate)
- npm dependencies audited with `npm audit` (CI gate)
- Sentinel is vendored and pinned to a specific version
- Dependencies are scanned for CVEs before deployment

---

## 9. Security Incident Response

| Scenario | Response |
|----------|----------|
| Compromised PASETO key | Rotate key in Sentinel, invalidate all sessions, force re-login |
| Compromised DB credentials | Rotate credentials, audit all recent queries from that user |
| Data breach (app schema) | Event names and expense data exposed — no PII stored in app schema |
| Data breach (auth schema) | Sentinel handles — force password reset, invalidate sessions |
| DoS attack | Rate limiting, auto-scaling, WAF in front |

---

## 10. Security Checklist

- [ ] Sentinel `HEX_KEY` is 32-byte hex, securely generated
- [ ] Sentinel `CONFIG_ENCRYPTION_KEY` is 32-byte hex, securely generated
- [ ] pitboss-api uses read-only DB credentials for auth schema
- [ ] CORS whitelist contains only explicit origins
- [ ] All SQL uses parameterized queries
- [ ] Rate limiting is configured and tested
- [ ] TLS is configured at the reverse proxy
- [ ] Security headers are applied
- [ ] Audit logging is enabled for all mutations
- [ ] `cargo audit` and `npm audit` pass in CI
- [ ] `.env` files are gitignored
- [ ] No secrets in Dockerfiles or Docker Compose files
- [ ] Event membership is enforced on every endpoint
- [ ] PASETO token validation is comprehensive (signature, expiry, audience)

---

*Next: [Overview](./overview.md) · [Data Model](./data-model.md) · [API Design](./api-design.md)*
