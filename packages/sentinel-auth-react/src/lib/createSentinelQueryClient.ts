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
  if (error instanceof SentinelError) {
    return error.statusCode === 401;
  }
  // Handle plain API errors like { message: string; status?: number }
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: unknown }).status === 401;
  }
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
        // Handle 401 for both SentinelError AND plain API errors
        if (is401Error(err)) {
          void (async () => {
            const refreshed = await refreshTokens();
            if (refreshed) {
              void client.invalidateQueries();
            } else {
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
