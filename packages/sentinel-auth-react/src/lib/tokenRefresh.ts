import { AuthClient } from "@moshsplit/sentinel-sdk";
import { useAuthStore } from "../store/authStore";

type SentinelAuthClient = AuthClient;

/**
 * Module-level client reference set by SentinelAuthProvider.
 * Allows refreshTokens() to be called outside of React context
 * (e.g. from a QueryCache.onError handler or createSentinelQueryClient).
 */
let _client: SentinelAuthClient | null = null;

export function registerTokenRefreshClient(client: SentinelAuthClient): void {
  _client = client;
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Deduped token refresh — concurrent callers share the same in-flight promise.
 * Returns true if the refresh succeeded, false otherwise.
 */
export async function refreshTokens(): Promise<boolean> {
  console.log('[tokenRefresh] refreshTokens called');
  if (!_client) {
    console.log('[tokenRefresh] No client registered, returning false');
    return false;
  }
  if (refreshPromise) {
    console.log('[tokenRefresh] Already refreshing, returning existing promise');
    return refreshPromise;
  }

  const p = (async () => {
    try {
      const { refreshToken, emailVerified, mustChangePassword } = useAuthStore.getState();
      console.log('[tokenRefresh] Got state, refreshToken exists:', !!refreshToken);
      console.log('[tokenRefresh] Calling _client.refreshSession...');
      const session = await _client!.refreshSession(refreshToken!);
      console.log('[tokenRefresh] refreshSession succeeded, session:', session);
      useAuthStore.getState().setSession(
        session.userId,
        session.accessToken,
        session.refreshToken,
        emailVerified,
        mustChangePassword,
      );
      console.log('[tokenRefresh] Session updated successfully');
      return true;
    } catch (err) {
      console.error('[tokenRefresh] refreshSession failed:', err);
      return false;
    }
  })();

  refreshPromise = p;
  // Clear the promise reference AFTER all callers have received the result —
  // using void+finally so the null assignment runs after the microtask queue.
  void p.finally(() => {
    refreshPromise = null;
  });

  return p;
}
