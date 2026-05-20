# Refresh Token Bug - Root Cause Analysis & Fix

## Problem
Users were being logged out repeatedly because the refresh token flow was broken.

## Root Causes Identified

### 1. Frontend Bug - Login doesn't store refresh token (CRITICAL)
**File:** `apps/web/src/pages/auth/LoginPage.tsx`

**Issue:** The login handler was passing an empty string `''` for the refresh token:
```tsx
// BEFORE (buggy):
setSession(result.user.id, result.token, '', true, false);
```

**Fix:** Now correctly stores the refresh token from the login response:
```tsx
// AFTER (fixed):
setSession(result.user.id, result.token, result.refreshToken, true, false);
```

### 2. Frontend Bug - authApi.login() doesn't return refresh token (CRITICAL)
**File:** `apps/web/src/api/auth.api.ts`

**Issue:** The `login()` function only returned the access token, not the refresh token:
```ts
// BEFORE (buggy):
return {
  token: result.session.accessToken,
  user: { ... },
};
```

**Fix:** Now returns both tokens:
```ts
// AFTER (fixed):
return {
  token: result.session.accessToken,
  refreshToken: result.session.refreshToken,
  user: { ... },
};
```

Also added `RefreshTokenRequest` and `RefreshTokenResponse` types and a `refreshToken()` method.

### 3. Backend Bug - sentinel-client missing refresh_token() method
**File:** `packages/sentinel-client/src/client.rs`

**Issue:** The `RefreshTokenRequest` and `RefreshTokenResponse` types existed in `types.rs`, but there was no `refresh_token()` method implemented in `client.rs`.

**Fix:** Added `refresh_token()` method that calls Sentinel's `/v1/api/auth/token/refresh` endpoint:
```rust
pub async fn refresh_token(&self, _user_id: &str, refresh_token: &str) -> Result<RefreshTokenResponse>
```

### 4. Backend Bug - pitboss-api missing refresh endpoint
**File:** `apps/pitboss-api/src/infrastructure/http/api/handlers/auth_handlers.rs`
**File:** `apps/pitboss-api/src/infrastructure/http/api/routes/api_router.rs`

**Issue:** No refresh token endpoint was exposed by pitboss-api.

**Fix:** 
- Added `refresh_token` handler in `auth_handlers.rs`
- Added route `/v1/auth/refresh` in `api_router.rs`

Note: The frontend's `sentinel-auth-react` package calls Sentinel directly for refresh (not through pitboss-api), but having the endpoint in pitboss-api provides an alternative path and better API consistency.

## How Token Refresh Works (After Fix)

1. **Login Flow:**
   - User logs in via `authApi.login()`
   - Sentinel returns session with `accessToken` and `refreshToken`
   - Frontend stores BOTH tokens in Zustand auth store (persisted to localStorage)

2. **Token Expiry:**
   - Access token expires (typically short-lived, e.g., 15 minutes)
   - Frontend API call fails with 401

3. **Automatic Refresh:**
   - TanStack Query's `onError` handler detects 401
   - Calls `refreshTokens()` from `sentinel-auth-react`
   - `refreshTokens()` calls `AuthClient.refreshSession()` which calls Sentinel's `/v1/api/auth/token/refresh`
   - Sentinel validates refresh token and returns new session
   - New tokens are stored in auth store
   - Failed queries are retried with new access token

4. **Refresh Token Expiry:**
   - If refresh token is expired/invalid, refresh fails
   - User is logged out and redirected to login page

## Files Modified

### Frontend
- `apps/web/src/api/auth.api.ts` - Added refreshToken to LoginResponse, added refreshToken() method
- `apps/web/src/api/config.ts` - Added refresh endpoint config
- `apps/web/src/pages/auth/LoginPage.tsx` - Fixed setSession to store refresh token

### Backend
- `packages/sentinel-client/src/client.rs` - Added refresh_token() method
- `packages/sentinel-client/src/lib.rs` - Exported RefreshTokenRequest/Response types
- `apps/pitboss-api/src/infrastructure/http/api/handlers/auth_handlers.rs` - Added refresh_token handler
- `apps/pitboss-api/src/infrastructure/http/api/routes/api_router.rs` - Added /v1/auth/refresh route

## Testing Recommendations

1. **Test Login Flow:**
   ```bash
   # Login and verify refresh token is stored in localStorage
   # Check browser dev tools → Application → Local Storage → sentinel-auth
   # Should see refreshToken field populated (not empty string)
   ```

2. **Test Token Refresh:**
   ```bash
   # Wait for access token to expire (or manually invalidate)
   # Make an API call
   # Should see automatic refresh in console logs
   # [tokenRefresh] refreshTokens called
   # [tokenRefresh] refreshSession succeeded
   ```

3. **Test Direct Refresh Endpoint:**
   ```bash
   curl -X POST http://localhost:8080/v1/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"user_id":"<user-id>","refresh_token":"<refresh-token>"}'
   ```

## Why This Bug Was Hard to Find

1. **External login worked:** The "Dev Login" button in `LoginCard.tsx` correctly stored the refresh token, so developers testing with that button didn't see the issue.

2. **Regular login silently failed:** The regular login flow stored an empty string for refresh token, so when refresh was attempted, it would fail silently.

3. **Multiple layers:** The bug spanned frontend API layer, frontend page component, and backend client library.

4. **No error logging:** The refresh failure didn't produce visible errors - it just resulted in users being logged out.
