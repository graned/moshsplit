# MoshSplit Auth — External Integration Kit

Self-contained copy/paste integration for authenticating users into
MoshSplit from an external app using API tokens.

## Quick start

```ts
import { moshsplit } from './moshsplit-auth';

moshsplit.configure({
  apiUrl: 'https://moshsplit.example.com',
  sentinelUrl: 'https://auth.moshsplit.example.com',
});

const session = await moshsplit.login({
  apiToken: 'sat_xxxxxxxxxxxxxxxxxxxx',
  email: 'user@example.com',
});

console.log('Logged in as', session.profile.first_name);
moshsplit.redirectToApp('/app/home');
```

## How it works

```
Your App                  MoshSplit Pitboss API          Sentinel Auth
  │                              │                           │
  │  POST /v1/auth/external-login │                           │
  │  { api_token, email }        │                           │
  │ ──────────────────────────>  │  token exchange            │
  │                              │ ───────────────────────>   │
  │                              │ <────── session tokens ─── │
  │ <── { user_id, tokens } ──── │                           │
  │                              │                           │
  │  GET /v1/api/user/me        │                           │
  │  Authorization: Bearer ...   │                           │
  │ ─────────────────────────────────────────────────────>   │
  │ <───────── user profile ──────────────────────────────   │
  │                              │                           │
  │  Save tokens to localStorage │                           │
  │  Redirect to /app/home       │                           │
```

## Installation options

### Copy/paste (recommended for quick start)

1. Copy `moshsplit-auth.ts` into your project.
2. Import and call as shown above.

### GitHub URL (versioned)

Download a specific version by tag:

```bash
curl -O \
  https://raw.githubusercontent.com/graned/moshsplit/v0.1.0/packages/external-integration/moshsplit-auth.ts
```

Replace `v0.1.0` with the git tag for the version you need.  The file is
self-contained — no other files from the repo are required.

## API reference

### `moshsplit.configure(overrides)`

| Option | Default | Description |
|--------|---------|-------------|
| `apiUrl` | `http://localhost:8080` | Pitboss API base URL |
| `sentinelUrl` | `http://localhost:9000` | Sentinel auth service URL |
| `storagePrefix` | `moshsplit_` | Prefix for localStorage keys |

Call once before `login()`.

### `moshsplit.login({ apiToken, email })`

| Field | Description |
|-------|-------------|
| `apiToken` | A `sat_*` API token (obtained from Sentinel admin panel) |
| `email` | Email of the user to log in as |

Returns `LoginResult`:

```ts
{
  user_id: string;
  access_token: string;   // PASETO v4.local.* session token
  refresh_token: string;
  expires_at: string;     // ISO-8601
  email_verified: boolean;
  profile: {              // best-effort, may be partial
    user_id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}
```

### `moshsplit.logout()`

Clears all stored session data from `localStorage`.

### `moshsplit.isAuthenticated()`

Returns `true` if an `access_token` exists in storage.

### `moshsplit.getStored(key)`

Read a stored value by key (without the prefix).  For example
`moshsplit.getStored('user_id')` returns the stored user ID.

### `moshsplit.redirectToApp(path)`

Redirect the browser to the MoshSplit app.  The app picks up the
session from `localStorage`.  Default path: `/app/home`.

## Setting up an API token

1. Open the Sentinel admin UI.
2. Navigate to **API Tokens** and create a new token.
3. Assign the token to an admin user.
4. Copy the `sat_*` value — it is shown only once.
5. Store it in your external app's configuration (env var, secrets
   manager, etc.).

## Notes

- The profile fetch is best-effort — if Sentinel is unreachable the
  login still succeeds with an empty profile.
- All storage writes use `localStorage`.  In SSR environments they are
  silently skipped.
- This file has **zero npm dependencies** — it uses only the `fetch` API
  and `localStorage` which are available in all modern browsers.
