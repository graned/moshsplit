# Sentinel Auth Integration Guide

> Reusable guide for integrating Sentinel auth service into any project.

## Overview

Sentinel is a Rust-based authentication and authorization service providing:
- User registration & login (email/password)
- Session management with PASETO tokens
- MFA (TOTP) support
- Role-based access control (RBAC)
- OIDC/OAuth 2.0 provider
- Email verification & password reset flows

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                     (Vite Dev Server)                       │
│                                                              │
│   Auth requests → http://localhost:9000  (Sentinel)          │
│   Web requests  → http://localhost:8080  (Your API)          │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
         ┌──────────────────┐  ┌─────────────────┐
         │  Sentinel Core    │  │  Your Backend   │
         │  (Rust Auth Svc)  │  │  (Your API)     │
         │  Port: 9000→8000  │  │  Port: 8080     │
         └────────┬──────────┘  └────────┬────────┘
                  │                     │
                  └─────────┬───────────┘
                            ▼
                  ┌──────────────────┐
                  │    PostgreSQL    │
                  │   (auth schema)   │
                  └──────────────────┘
```

---

## Quick Start

### 1. Docker Compose Setup

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: sentinel
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-sentinel_dev}
      POSTGRES_DB: synra
      POSTGRES_HOST_AUTH_METHOD: trust
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-net

  sentinel:
    build:
      context: ./vendor/sentinel
      dockerfile: apps/sentinel-core/Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "${SENTINEL_PORT:-9000}:8000"
    environment:
      HEX_KEY: ${HEX_KEY}
      CONFIG_ENCRYPTION_KEY: ${CONFIG_ENCRYPTION_KEY}
      RUST_LOG: info
      CORS_ALLOWED_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173,http://localhost:3000}
      DATABASE_URL: postgres://sentinel:${POSTGRES_PASSWORD:-sentinel_dev}@postgres:5432/synra
      PGOPTIONS: "-c search_path=auth"
    networks:
      - app-net

volumes:
  postgres_data:

networks:
  app-net:
    driver: bridge
```

### 2. Environment Variables

```bash
# .env
# Required for Sentinel
HEX_KEY=0000000000000000000000000000000000000000000000000000000000000000  # 32-byte hex
CONFIG_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000  # 32-byte hex

# Database
POSTGRES_PASSWORD=sentinel_dev

# CORS - comma-separated origins
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Ports
SENTINEL_PORT=9000
```

### 3. Database Initialization

```sql
-- init.sql
CREATE SCHEMA IF NOT EXISTS auth;

-- Migrations run automatically via Diesel
```

---

## Frontend Integration

### 1. Install SDK

```bash
npm install @sentinel/auth-sdk
```

### 2. Configure Client

```typescript
// src/api/sentinel.ts
import { SentinelAuthClient } from '@sentinel/auth-sdk'

export const sentinelClient = new SentinelAuthClient({
  baseUrl: import.meta.env.VITE_SENTINEL_URL ?? 'http://localhost:9000',
  refreshBufferMs: 300_000,  // 5 min before expiry
})
```

### 3. Environment Configuration

```bash
# .env.local
VITE_SENTINEL_URL=http://localhost:9000
```

> **Note**: Browser → Sentinel uses `localhost:9000`. Sentinel runs in Docker but browser connects directly via port mapping.

### 4. Auth Store Pattern (Zustand)

```typescript
// src/stores/auth.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sentinelClient } from '@/api/sentinel'

interface AuthState {
  userId: string | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: string | null
  isAuthenticated: boolean
  emailVerified: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      userId: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isAuthenticated: false,
      emailVerified: false,

      login: async (email, password) => {
        const result = await sentinelClient.auth.basicLogin(email, password)

        if (result.mfa_required) {
          throw { type: 'mfa_required', mfaSessionToken: result.mfa_session_token }
        }

        set({
          userId: result.user_id,
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          expiresAt: result.expires_at,
          isAuthenticated: true,
        })
      },

      logout: async () => {
        if (get().accessToken) {
          await sentinelClient.auth.logout(get().accessToken!)
        }
        set({
          userId: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          isAuthenticated: false,
          emailVerified: false,
        })
      },

      restoreSession: async () => {
        const { userId, refreshToken } = get()
        if (!userId || !refreshToken) return

        try {
          const session = await sentinelClient.auth.refreshSession(userId, refreshToken)
          const profile = await sentinelClient.user.getMe(session.access_token)

          set({
            userId: session.user_id,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
            isAuthenticated: true,
            emailVerified: profile.email_verified,
          })
        } catch (error) {
          // Token expired or invalid - clear session
          set({
            userId: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        userId: state.userId,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      }),
    }
  )
)
```

---

## API Integration

### Register Flow

```typescript
// POST /v1/api/auth/register
const result = await sentinelClient.auth.register({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  password: 'SecurePass123!',
})

// Result: { user_id, first_name, last_name, status: 'PendingVerification' }
// Email verification email sent (if SMTP configured)
```

### Login Flow

```typescript
const result = await sentinelClient.auth.basicLogin(email, password)

// Success (no MFA):
// { user_id, access_token, refresh_token, expires_at, mfa_required: false }

// MFA Required:
{ mfa_required: true, mfa_session_token: '...' }
// → Redirect user to MFA verify page
```

### MFA Verify

```typescript
const session = await sentinelClient.auth.mfaVerify({
  mfa_session_token: mfaSessionToken,
  code: '123456',
})
// Returns full session tokens on success
```

### Profile Update

```typescript
// PATCH /v1/api/user/me
const profile = await sentinelClient.user.updateMe(accessToken, {
  first_name: 'Jane',
  avatar_url: 'https://example.com/avatar.png',
})
```

### Change Password

```typescript
// POST /v1/api/user/password/change
await sentinelClient.user.changePassword(accessToken, {
  current_password: oldPassword,
  new_password: newPassword,
})
```

---

## Endpoints Reference

### Auth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/api/auth/register` | None | Register new user |
| POST | `/v1/api/auth/login` | None | Login (may return MFA challenge) |
| POST | `/v1/api/auth/mfa/verify` | None | Verify MFA code |
| POST | `/v1/api/auth/logout` | Bearer | Logout current session |
| POST | `/v1/api/auth/token/refresh` | None | Refresh access token |
| POST | `/v1/api/auth/verify-email` | None | Verify email (from email link) |
| POST | `/v1/api/auth/password/forgot` | None | Request password reset |
| POST | `/v1/api/auth/password/reset` | None | Reset password with token |

### User Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/api/user/me` | Bearer | Get current user profile |
| PATCH | `/v1/api/user/me` | Bearer | Update profile (first_name, last_name, avatar_url) |
| POST | `/v1/api/user/password/change` | Bearer | Change password |
| GET | `/v1/api/user/sessions` | Bearer | List all sessions |
| GET | `/v1/api/user/permissions` | Bearer | Get user roles |

### MFA Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/api/auth/mfa/totp/start` | Bearer | Start MFA enrollment |
| POST | `/v1/api/auth/mfa/totp/confirm` | Bearer | Confirm MFA enrollment |

---

## Response Format

All `/v1/api/*` responses are wrapped:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-05-10T10:00:00.000Z",
  "request_id": "uuid"
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AUTH_ERROR",
    "message": "Invalid email or password"
  },
  "timestamp": "...",
  "request_id": "uuid"
}
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_ERROR` | 401 | Invalid credentials |
| `INVALID_TOKEN` | 401 | Token invalid or malformed |
| `EXPIRED_TOKEN` | 401 | Token has expired |
| `MISSING_TOKEN` | 401 | No authorization header |
| `EMAIL_NOT_VERIFIED` | 403 | Email not verified |
| `MFA_INVALID_CODE` | 401 | Wrong MFA code |
| `MFA_ATTEMPT_LIMIT` | 429 | Too many MFA attempts |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 400 | Invalid input |

---

## CORS Configuration

Sentinel uses `CORS_ALLOWED_ORIGINS` environment variable:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

- Separate multiple origins with commas
- No wildcard support (explicit origins only)
- Preflight (OPTIONS) requests handled automatically

---

## Database Schema

Sentinel uses `auth` schema in PostgreSQL:

### Key Tables

- `users` - User accounts (first_name, last_name, avatar_url, status)
- `user_identities` - Email/identity info (email, email_verified)
- `sessions` - Active sessions (PASETO token data)
- `user_mfa_totp` - MFA TOTP secrets
- `user_recovery_codes` - MFA recovery codes

### Schema Generation

```bash
cd vendor/sentinel/apps/sentinel-core
diesel migration run
```

---

## Testing

### Integration Test Pattern

```rust
#[tokio::test]
async fn update_profile_with_all_fields_returns_200() {
    // 1. Register and login
    let email = format!("test_{}@example.com", uuid::Uuid::new_v4());
    let password = "SecurePass123!";

    // 2. Pre-verify email (required for auth middleware)
    mark_email_verified(&email).await;

    // 3. Login to get access token
    let (access_token, _) = login(&email, &password).await;

    // 4. Make authenticated request
    let res = patch_json(
        "http://localhost:9000/v1/api/user/me",
        &json!({ "first_name": "Jane" }),
        Some(&access_token),
        &unique_ip(),
    ).await;

    // 5. Assert
    let (status, body, _) = read_json(res).await;
    assert_eq!(status, 200);
    assert_api_envelope_shape(&body);
}
```

---

## Production Checklist

- [ ] Generate secure `HEX_KEY` (32-byte hex)
- [ ] Generate secure `CONFIG_ENCRYPTION_KEY` (32-byte hex)
- [ ] Configure SMTP provider for emails
- [ ] Set proper `CORS_ALLOWED_ORIGINS`
- [ ] Set `FRONTEND_URL` for email verification links
- [ ] Use PostgreSQL with `pgcrypto` extension
- [ ] Configure backup for PostgreSQL
- [ ] Set up TLS termination (reverse proxy)
- [ ] Configure rate limiting appropriately
- [ ] Set proper logging level (info/warn/error)

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `HEX_KEY` | Yes | 32-byte hex for session encryption |
| `CONFIG_ENCRYPTION_KEY` | Yes | 32-byte hex for config encryption |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PGOPTIONS` | Yes | Set `search_path=auth` |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated allowed origins |
| `FRONTEND_URL` | Yes | Base URL for email links |
| `OIDC_ISSUER_URL` | No | OIDC issuer URL (default: self) |
| `RUST_LOG` | No | Logging level (default: info) |
| `RUST_BACKTRACE` | No | Enable backtraces (default: 1) |

---

## Troubleshooting

### Connection Refused (8080)

**Problem**: `PATCH http://localhost:8080/user/me net::ERR_CONNECTION_REFUSED`

**Cause**: Using wrong port for Sentinel. Sentinel runs on port 9000 (mapped from 8000).

**Fix**: Ensure `VITE_SENTINEL_URL=http://localhost:9000` in frontend.

### CORS Errors

**Problem**: `Access-Control-Allow-Origin` not present

**Cause**: Origin not in `CORS_ALLOWED_ORIGINS`

**Fix**: Add your origin to the env var, restart Sentinel.

### Email Not Verified

**Problem**: `403 EMAIL_NOT_VERIFIED` on protected endpoints

**Cause**: User registered but email not verified

**Fix**: Either configure SMTP for verification emails, or pre-verify users in development.

### Refresh Token Not Found

**Problem**: `INVALID_TOKEN` error after login

**Cause**: Token storage not working or session cleared

**Fix**: Check Zustand persist configuration, ensure `refreshToken` is stored.
