/**
 * Factory that creates a pre-configured TanStack QueryClient for Sentinel apps.
 *
 * The QueryCache `onError` handler provides automatic session recovery:
 *
 * | Error | Action |
 * |-------|--------|
 * | `401` | Attempt token refresh; on success invalidate all queries; on failure clear session + redirect to login |
 * | `EmailNotVerifiedError` | Redirect to `verifyEmail` path |
 * | `403 MUST_CHANGE_PASSWORD` | Redirect to `changePassword` path |
 * | `403` (other) | Redirect to `unauthorized` path |
 *
 * The `retry` option is set to never retry 401 errors — the query function already
 * attempted one refresh-and-retry internally, so a second attempt would cascade.
 *
 * @param redirects - Optional redirect path overrides.  Defaults match the standard
 *   Sentinel auth route paths (`/login`, `/verify-email`, `/change-password`, `/unauthorized`).
 */
import { QueryClient, QueryCache } from "@tanstack/react-query";
import { SentinelError, EmailNotVerifiedError } from "@moshsplit/sentinel-sdk";
import { useAuthStore } from "../store/authStore";
import { refreshTokens } from "./tokenRefresh";
import type { SentinelAuthRedirects } from "../types";

// Helper to check if error is a 401 (handles both SentinelError and plain API errors)
function is401Error(error: unknown): boolean {
  console.log('[createSentinelQueryClient] Checking error:', error);
  if (error instanceof SentinelError) {
    console.log('[createSentinelQueryClient] SentinelError, statusCode:', error.statusCode);
    return error.statusCode === 401;
  }

  // Handle wrapped pitboss-api response: { success: false, error: { message: 'HTTP 401' } }
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    // Check for wrapped error format
    if (err.error && typeof err.error === 'object') {
      const innerError = err.error as Record<string, unknown>;
      if (innerError.message === 'HTTP 401' || String(innerError.message).includes('401')) {
        console.log('[createSentinelQueryClient] Wrapped error detected, is 401');
        return true;
      }
    }
    // Check for plain API errors like { message: string; status?: number }
    if ('status' in err) {
      const status = err.status;
      console.log('[createSentinelQueryClient] Plain error, status:', status);
      return status === 401;
    }
  }

  console.log('[createSentinelQueryClient] Not a 401 error');
  return false;
}

export function createSentinelQueryClient(redirects?: SentinelAuthRedirects): QueryClient {
  const loginPath = redirects?.afterLogout ?? redirects?.login ?? "/login";
  const verifyEmailPath = redirects?.verifyEmail ?? "/verify-email";
  const changePasswordPath = redirects?.changePassword ?? "/change-password";
  const unauthorizedPath = redirects?.unauthorized ?? "/unauthorized";

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          // Never retry 401s — withAuthRetry already attempted one refresh+retry
          // inside the queryFn. Retrying here would re-run with an empty token
          // (after clearTokens()) and produce a cascade of MISSING_TOKEN errors.
          if (is401Error(error)) return false;
          return failureCount < 1;
        },
        staleTime: 30_000,
      },
    },
    queryCache: new QueryCache({
      onError: (err) => {
        console.log('[QueryCache onError] Error received:', err);
        // Handle 401 for both SentinelError AND plain API errors
        if (is401Error(err)) {
          console.log('[QueryCache onError] Detected 401, attempting token refresh...');
          void (async () => {
            const refreshed = await refreshTokens();
            console.log('[QueryCache onError] Token refresh result:', refreshed);
            if (refreshed) {
              void client.invalidateQueries();
            } else {
              console.log('[QueryCache onError] Token refresh failed, clearing tokens');
              useAuthStore.getState().clearTokens();
              window.location.href = loginPath;
            }
          })();
          return;
        }

        // Only handle SentinelError-specific errors if it's actually a SentinelError
        if (!(err instanceof SentinelError)) return;

        if (err instanceof EmailNotVerifiedError) {
          window.location.href = verifyEmailPath;
        } else if (err.statusCode === 403 && err.code === "MUST_CHANGE_PASSWORD") {
          window.location.href = changePasswordPath;
        } else if (err.statusCode === 403) {
          window.location.href = unauthorizedPath;
        }
      },
    }),
  });
  return client;
}
