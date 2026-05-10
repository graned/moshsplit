# MoshSplit API Design

> **Status**: Draft  
> **Last Updated**: 2026-05-10  
> **See also**: [Overview](./overview.md) · [Data Model](./data-model.md) · [Security Architecture](./security.md)

---

## 1. API Conventions

### 1.1 Base URL

```
Development: http://localhost:8080/v1
Production:  https://api.moshsplit.app/v1
```

### 1.2 Content Type

All requests and responses use `application/json`. The `Accept` header must include `application/json`.

### 1.3 Versioning

- URL-prefixed versioning: `/v1/`
- Breaking changes → new version (`/v2/`)
- Old versions are supported for a minimum of 6 months after deprecation notice
- Version is announced in the `X-API-Version` response header

### 1.4 Standard Response Envelope

All responses (both success and error) follow a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "request_id": "uuid",
    "timestamp": "2026-05-10T10:00:00.000Z",
    "version": "1.0"
  }
}
```

**Success**:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "request_id": "...", "timestamp": "...", "version": "1.0" }
}
```

**Error**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [
      { "field": "amount_cents", "message": "Must be a positive integer" }
    ]
  },
  "meta": { "request_id": "...", "timestamp": "...", "version": "1.0" }
}
```

### 1.5 Pagination

List endpoints use cursor-based pagination:

**Request**:
```
GET /v1/events/:id/expenses?cursor=2026-05-01T00:00:00Z&limit=20
```

**Response**:
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "version": "1.0",
    "pagination": {
      "next_cursor": "2026-05-10T10:00:00Z",
      "has_more": true,
      "limit": 20
    }
  }
}
```

- `cursor` is a timestamp-based opaque token (typically `created_at` of the last item)
- `limit` defaults to 20, max 100
- `has_more` indicates whether additional results exist

### 1.6 HTTP Methods

| Method | Semantics |
|--------|-----------|
| `GET` | Read resource (idempotent, safe) |
| `POST` | Create resource (not idempotent) |
| `PUT` | Full replace (idempotent) |
| `PATCH` | Partial update (idempotent) |
| `DELETE` | Remove/soft-delete (idempotent) |

### 1.7 Standard Headers

| Header | When | Purpose |
|--------|------|---------|
| `Authorization: Bearer <token>` | All authenticated requests | PASETO token from Sentinel |
| `Idempotency-Key: <uuid>` | POST requests (optional) | Idempotent creation |
| `X-Request-Id: <uuid>` | All requests | Request tracing |
| `Accept-Language` | Optional | Locale for error messages |

### 1.8 HTTP Status Codes

| Code | Usage |
|------|-------|
| `200 OK` | Successful read, update, delete |
| `201 Created` | Successful creation |
| `204 No Content` | Successful delete (no body) |
| `400 Bad Request` | Validation error |
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Authenticated but not authorized (not a member, wrong role) |
| `404 Not Found` | Resource doesn't exist |
| `409 Conflict` | Version conflict (optimistic locking) |
| `422 Unprocessable Entity` | Business rule violation (e.g., self-payment) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Server error (retryable) |

---

## 2. Authentication Flow

MoshSplit does not implement authentication — it delegates entirely to **Sentinel**.

### 2.1 Token Acquisition

```
Browser                    Sentinel                     pitboss-api
  │                          │                              │
  │── POST /v1/api/auth ─────▶                              │
  │   /login (email, pass)   │                              │
  │◀───── { access_token,    │                              │
  │         refresh_token }  │                              │
  │                          │                              │
  │── GET /v1/events ────────┼──────────▶ (with Bearer     │
  │                          │             token)           │
  │                          │                              │
  │                          │   pitboss-api validates:     │
  │                          │   1. Token signature         │
  │                          │   2. Token expiry            │
  │                          │   3. Extract user_id         │
  │                          │                              │
  │◀─────────────────────────┼────────── { events data }    │
```

### 2.2 Token Format

- **PASETO v4.local** (symmetric encryption) for Sentinel sessions
- pitboss-api receives the public/decryption key at startup via `SENTINEL_PUBLIC_KEY`
- Tokens contain: `user_id`, `session_id`, `exp`, `iat`, `roles`

### 2.3 Token Validation in pitboss-api

```rust
// Pseudocode for Axum middleware
async fn auth_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, AuthError> {
    let token = extract_bearer_token(&req)?;
    let token_data = sentinel_validator::verify_paseto(token)?;
    req.extensions_mut().insert(AuthUser {
        user_id: token_data.user_id,
        roles: token_data.roles,
    });
    Ok(next.run(req).await)
}
```

### 2.4 Idempotency

POST requests can include an `Idempotency-Key` header. On duplicate requests within the idempotency window (15 minutes), the server returns the original response without re-executing the mutation.

---

## 3. Core Endpoints

### 3.1 Events

#### `GET /v1/events` — List user's events

Returns events where the authenticated user is an active member.

```
GET /v1/events?status=active&cursor=...&limit=20
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Wacken 2026",
      "description": "Metal festival trip",
      "currency": "EUR",
      "status": "active",
      "member_count": 5,
      "member_balance_cents": -5000,
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-05-10T08:00:00Z"
    }
  ],
  "meta": { ... }
}
```

#### `POST /v1/events` — Create event

```json
{
  "name": "Wacken 2026",
  "description": "Metal festival trip",
  "currency": "EUR"
}
```

**Response**: `201 Created` with the new event object. Creator is automatically added as `admin`.

#### `GET /v1/events/:id` — Get event details

Returns event details and member list.

#### `PATCH /v1/events/:id` — Update event

```json
{
  "name": "Wacken 2026 - Updated",
  "description": "Updated description"
}
```

Requires `admin` role in the event.

#### `DELETE /v1/events/:id` — Archive event

Soft-deletes (archives) the event. Only `admin` can archive. Archived events are excluded from default listing but still accessible by ID.

### 3.2 Event Members

#### `GET /v1/events/:id/members` — List members

```json
{
  "success": true,
  "data": [
    {
      "user_id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "avatar_url": "https://...",
      "role": "admin",
      "joined_at": "2026-01-15T10:00:00Z",
      "balance_cents": -5000
    }
  ]
}
```

#### `POST /v1/events/:id/members` — Add member

```json
{
  "user_id": "uuid",
  "role": "member"
}
```

Requires `admin` role. User must be a registered Sentinel user.

#### `DELETE /v1/events/:id/members/:userId` — Remove member

Sets `left_at` on the membership record. Does not delete past expenses or payments.

### 3.3 Expenses

#### `GET /v1/events/:id/expenses` — List expenses

```
GET /v1/events/:id/expenses?cursor=...&limit=20&include_deleted=false
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Hotel booking",
      "description": "3 nights at the hostel",
      "amount_cents": 15000,
      "currency": "EUR",
      "paid_by": {
        "user_id": "uuid",
        "first_name": "John",
        "last_name": "Doe"
      },
      "split_type": "equal",
      "split_data": { ... },
      "version": 3,
      "my_share_cents": 5000,
      "created_at": "2026-01-20T14:00:00Z",
      "updated_at": "2026-02-01T09:00:00Z"
    }
  ],
  "meta": { "pagination": { ... } }
}
```

#### `POST /v1/events/:id/expenses` — Create expense

```json
{
  "title": "Hotel booking",
  "description": "3 nights at the hostel",
  "amount_cents": 15000,
  "currency": "EUR",
  "paid_by": "user-uuid",
  "split_type": "equal",
  "split_data": {
    "shares": ["user-a", "user-b", "user-c"]
  },
  "notes": "Booked through Booking.com"
}
```

**Response**: `201 Created` with expense. Creates version 1.

#### `GET /v1/events/:id/expenses/:expenseId` — Get expense

Returns the expense with its latest version and version history.

#### `PATCH /v1/events/:id/expenses/:expenseId` — Update expense

Creates a **new version** of the expense. Does not overwrite the previous version.

```json
{
  "title": "Hotel booking (updated)",
  "amount_cents": 16000,
  "split_data": {
    "shares": ["user-a", "user-b", "user-c", "user-d"]
  }
}
```

**Response**: `200 OK` with the updated expense. The `version` field increments.

**Version history** is available at:
```
GET /v1/events/:id/expenses/:expenseId/versions
```

#### `DELETE /v1/events/:id/expenses/:expenseId` — Soft-delete expense

Sets `deleted_at` timestamp. Does not remove version history.

### 3.4 Payments

#### `GET /v1/events/:id/payments` — List payments

```
GET /v1/events/:id/payments?cursor=...&limit=20
```

#### `POST /v1/events/:id/payments` — Record payment

```json
{
  "from_user": "user-a-uuid",
  "to_user": "user-b-uuid",
  "amount_cents": 5000,
  "currency": "EUR",
  "description": "Paying back for hotel",
  "payment_method": "venmo",
  "external_ref": "transaction-123"
}
```

**Response**: `201 Created`

**Constraints**:
- Both users must be active event members
- `from_user` must differ from `to_user`
- Amount must be positive

#### `GET /v1/events/:id/payments/:paymentId` — Get payment

Payments have no update or delete endpoint. They are immutable.

### 3.5 Settlements

#### `GET /v1/events/:id/settlements` — List settlements

```
GET /v1/events/:id/settlements?status=confirmed&cursor=...&limit=20
```

#### `POST /v1/events/:id/settlements` — Propose settlement

```json
{
  "from_user": "user-a-uuid",
  "to_user": "user-b-uuid",
  "amount_cents": 5000
}
```

Creates settlement in `pending` status.

#### `PATCH /v1/events/:id/settlements/:settlementId` — Update status

```json
{
  "status": "confirmed"
}
```

Only `from_user` or `to_user` can confirm. Both parties must agree for `confirmed`.

#### `GET /v1/events/:id/settlements/:settlementId` — Get settlement

---

## 4. Balance Endpoints

### `GET /v1/events/:id/balances` — All balances for an event

Returns the net balance for each active member.

```json
{
  "success": true,
  "data": {
    "balances": [
      {
        "user_id": "uuid",
        "first_name": "John",
        "last_name": "Doe",
        "balance_cents": -5000,
        "total_paid_cents": 20000,
        "total_owed_cents": 25000
      },
      {
        "user_id": "uuid",
        "first_name": "Jane",
        "last_name": "Smith",
        "balance_cents": 5000,
        "total_paid_cents": 15000,
        "total_owed_cents": 10000
      }
    ],
    "total_balance_cents": 0,
    "currency": "EUR"
  }
}
```

- Positive balance = is owed money (has paid more than their share)
- Negative balance = owes money (has paid less than their share)
- `total_balance_cents` always sums to zero (conservation of money)

### `GET /v1/events/:id/balances/:userId` — Single user balance

```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "balance_cents": -5000,
    "total_paid_cents": 20000,
    "total_owed_cents": 25000,
    "currency": "EUR"
  }
}
```

### `GET /v1/events/:id/balances/simplified` — Simplified debts

Returns the minimum number of transactions needed to settle all debts.

```json
{
  "success": true,
  "data": {
    "transfers": [
      {
        "from_user": { "user_id": "uuid", "name": "John Doe" },
        "to_user": { "user_id": "uuid", "name": "Jane Smith" },
        "amount_cents": 5000
      }
    ],
    "algorithm": "greedy"
  }
}
```

### `GET /v1/events/:id/balances/:userId/explain` — Explain a balance

Provides a full breakdown of how a user's balance was computed:

```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "balance_cents": -5000,
    "breakdown": {
      "expenses_paid": [
        {
          "expense_id": "uuid",
          "title": "Hotel",
          "amount_cents": 15000,
          "current_version": 2
        }
      ],
      "expense_shares": [
        {
          "expense_id": "uuid",
          "title": "Hotel",
          "total_cents": 15000,
          "my_share_cents": 5000,
          "split_type": "equal"
        }
      ],
      "payments_sent": [
        {
          "payment_id": "uuid",
          "to_user": "Jane Smith",
          "amount_cents": 2000,
          "recorded_at": "2026-02-01T10:00:00Z"
        }
      ],
      "payments_received": [],
      "settlements_sent": [],
      "settlements_received": []
    }
  }
}
```

---

## 5. Error Handling

### 5.1 Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input (schema validation failed) |
| `UNAUTHORIZED` | 401 | No authentication token or invalid token |
| `TOKEN_EXPIRED` | 401 | Token has expired, refresh needed |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_A_MEMBER` | 403 | User is not an active event member |
| `NOT_FOUND` | 404 | Resource not found |
| `VERSION_CONFLICT` | 409 | Optimistic lock conflict (expense was modified by another user) |
| `SELF_PAYMENT` | 422 | Cannot pay yourself |
| `INVALID_SPLIT` | 422 | Split data doesn't sum to amount |
| `INVALID_STATUS_TRANSITION` | 422 | Cannot transition settlement status |
| `DUPLICATE_REQUEST` | 409 | Idempotency key already used with different request |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### 5.2 Validation Pattern

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      { "field": "amount_cents", "message": "Must be a positive integer" },
      { "field": "split_data", "message": "Split amounts must sum to amount_cents" }
    ]
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

### 5.3 Retry Strategy

Clients should implement exponential backoff for `5xx` errors:
- First retry: 1 second
- Second retry: 2 seconds
- Third retry: 4 seconds
- Max retries: 3

`4xx` errors should never be retried without user intervention.

---

## 6. Webhooks (Future)

| Event | Payload |
|-------|---------|
| `expense.created` | `{ event_id, expense_id, version, amount_cents, paid_by }` |
| `expense.updated` | `{ event_id, expense_id, new_version, previous_version }` |
| `payment.recorded` | `{ event_id, payment_id, from_user, to_user, amount_cents }` |
| `settlement.confirmed` | `{ event_id, settlement_id, from_user, to_user, amount_cents }` |

---

## 7. Rate Limiting

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| All authenticated endpoints | 100 requests | 1 minute per user |
| Balance computation | 30 requests | 1 minute per event |
| Expense/Payment creation | 20 requests | 1 minute per event |
| Auth (via Sentinel) | Managed by Sentinel | — |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1680000000
```

---

*Next: [Overview](./overview.md) · [Data Model](./data-model.md) · [Security Architecture](./security.md)*
