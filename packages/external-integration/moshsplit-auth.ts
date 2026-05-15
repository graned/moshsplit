// ─────────────────────────────────────────────────────────────────────────────
// MoshSplit Auth — External Integration Kit
// ─────────────────────────────────────────────────────────────────────────────
// Copy this file into your project to integrate with MoshSplit's external
// login flow.  No npm packages, no build step — just drop and call.
//
// Usage:
//   import { moshsplit } from './moshsplit-auth';
//
//   // 1.  Configure
//   moshsplit.configure({
//     apiUrl: 'https://your-moshsplit-instance.com',
//     sentinelUrl: 'https://your-sentinel-instance.com',
//   });
//
//   // 2.  Exchange an API token for a user session
//   const session = await moshsplit.login({
//     apiToken: 'sat_xxxxxxxxxxxxxxxxxxxx',
//     email: 'user@example.com',
//   });
//
//   // 3.  session contains { user_id, access_token, refresh_token, profile }
//
// Download via versioned URL:
//   curl -O \
//     https://raw.githubusercontent.com/graned/moshsplit/v0.1.0/packages/external-integration/moshsplit-auth.ts
//
// Replace `v0.1.0` with the git tag of the version you need.
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

interface MoshsplitConfig {
  /** Pitboss API base URL (the app backend).  Default: http://localhost:8080 */
  apiUrl: string;
  /** Sentinel auth service URL.  Default: http://localhost:9000 */
  sentinelUrl: string;
  /** Storage key prefix.  Default: "moshsplit_" */
  storagePrefix: string;
}

interface ExternalLoginRequest {
  api_token: string;
  email: string;
}

interface ExternalLoginResponse {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  email_verified: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

interface UserProfile {
  user_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface LoginResult {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  email_verified: boolean;
  /** User profile fetched from Sentinel (may be partial) */
  profile: UserProfile;
}

// ── Client ────────────────────────────────────────────────────────────────────

const DEFAULTS: MoshsplitConfig = {
  apiUrl: 'http://localhost:8080',
  sentinelUrl: 'http://localhost:9000',
  storagePrefix: 'moshsplit_',
};

let config: MoshsplitConfig = { ...DEFAULTS };

function cfg(): MoshsplitConfig {
  return config;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const moshsplit = {
  /** Override default config (call once at startup). */
  configure(overrides: Partial<MoshsplitConfig>): void {
    config = { ...DEFAULTS, ...overrides };
  },

  /**
   * Exchange an API token for a fully authenticated session.
   *
   * 1. Calls the pitboss-api token-exchange endpoint.
   * 2. Persists the session into localStorage.
   * 3. Fetches the user profile from Sentinel (best-effort).
   *
   * Returns the session + profile so you can inspect or redirect.
   */
  async login(opts: {
    apiToken: string;
    email: string;
  }): Promise<LoginResult> {
    const { apiToken, email } = opts;
    const c = cfg();

    // ── Step 1: token exchange ──────────────────────────────────────────
    const exchangeResponse = await fetch(
      `${c.apiUrl}/v1/auth/external-login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_token: apiToken,
          email,
        } satisfies ExternalLoginRequest),
      },
    );

    if (!exchangeResponse.ok) {
      const body = await exchangeResponse.json().catch(() => null);
      throw new Error(
        body?.error?.message ?? `Exchange failed (HTTP ${exchangeResponse.status})`,
      );
    }

    const exchangeBody: ApiEnvelope<ExternalLoginResponse> =
      await exchangeResponse.json();

    if (!exchangeBody.success || !exchangeBody.data) {
      throw new Error(
        exchangeBody.error?.message ?? 'Exchange returned an empty response',
      );
    }

    const { user_id, access_token, refresh_token, expires_at, email_verified } =
      exchangeBody.data;

    // ── Step 2: persist session ─────────────────────────────────────────
    const p = c.storagePrefix;
    setLocal(p + 'user_id', user_id);
    setLocal(p + 'access_token', access_token);
    setLocal(p + 'refresh_token', refresh_token);
    setLocal(p + 'expires_at', expires_at);
    setLocal(p + 'email_verified', String(email_verified));

    // ── Step 3: fetch user profile (best-effort) ────────────────────────
    let profile: UserProfile = {};
    try {
      const profileResponse = await fetch(
        `${c.sentinelUrl}/v1/api/user/me`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            Accept: 'application/json',
          },
        },
      );

      if (profileResponse.ok) {
        const profileBody: ApiEnvelope<UserProfile> =
          await profileResponse.json();
        if (profileBody.success && profileBody.data) {
          profile = profileBody.data;
          setLocal(p + 'user_email', profile.email ?? '');
          setLocal(p + 'first_name', profile.first_name ?? '');
          setLocal(p + 'last_name', profile.last_name ?? '');
        }
      }
    } catch {
      // Profile fetch is non-critical — continue with what we have
    }

    return {
      user_id,
      access_token,
      refresh_token,
      expires_at,
      email_verified,
      profile,
    };
  },

  /** Clear all stored session data. */
  logout(): void {
    const p = cfg().storagePrefix;
    const keys = [
      'user_id',
      'access_token',
      'refresh_token',
      'expires_at',
      'email_verified',
      'user_email',
      'first_name',
      'last_name',
    ];
    for (const k of keys) localStorage.removeItem(p + k);
  },

  /** Check whether a session exists in storage. */
  isAuthenticated(): boolean {
    return !!getLocal(cfg().storagePrefix + 'access_token');
  },

  /** Retrieve a stored value (handles SSR environments). */
  getStored(key: string): string | null {
    return getLocal(cfg().storagePrefix + key);
  },

  /**
   * Redirect to the MoshSplit app.
   * The app will pick up the session from localStorage.
   */
  redirectToApp(path = '/app/home'): void {
    const c = cfg();
    const base = c.apiUrl.replace(/\/api\/?$/, '');
    window.location.href = `${base}${path}`;
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be full or unavailable */
  }
}

function getLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
