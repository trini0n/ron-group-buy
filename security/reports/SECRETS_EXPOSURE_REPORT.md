# SECRETS_EXPOSURE Security Report

## Status: HIGH

## Findings

### 1. Live Discord Bot Token in `.env`
The `.env` file contains what appears to be a **real, live** Discord bot token:

```
DISCORD_BOT_TOKEN=[REDACTED — rotate this token immediately via Discord Developer Portal]
```

This is a complete, structurally valid Discord bot token (base64-encoded ID + timestamp + HMAC). If this token has ever been committed to git or shared, it must be rotated immediately via the Discord Developer Portal.

### 2. Live Supabase Project URL + Anon Key in `.env`
The `.env` file also contains the live project URL and anon key:

```
PUBLIC_SUPABASE_URL=https://ritpdjwomrvkfogqanlj.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These are expected to be "public" values (designed to be in client-side code), but they expose the project ID to anyone who sees the `.env`.

### 3. Live Supabase Service Role Key in `.env`
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

This is a **privileged key that bypasses RLS**. It's in `.env` (not committed), but it's a live key.

### 4. Git History Check
`git ls-files .env` returned empty — `.env` is **not currently tracked**. The `.gitignore` properly excludes `.env` and `.env.*` (while preserving `.env.example`).

However, the git history was not deep-scanned for previous accidental commits. This should be verified manually (see Manual Verification below).

### 5. `.env.example` — PASS
The `.env.example` file contains only placeholder values (e.g., `your-discord-bot-token`, `your-service-role-key`). No real credentials present.

### 6. Server-Only Secrets — PASS
`DISCORD_BOT_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` are only imported via `$env/static/private` in server-side files:
- `src/lib/server/notifications/discord.ts` — uses `DISCORD_BOT_TOKEN`
- `src/lib/server/admin.ts` — uses `SUPABASE_SERVICE_ROLE_KEY`

SvelteKit's `$env/static/private` **prevents these from being bundled into client-side code**. This is correctly implemented.

### 7. Public Env Vars — PASS
`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, and `PUBLIC_APP_URL` are public by design. They are imported via `$env/static/public`. None contain secret values.

### 8. Frontend Source Scan — PASS
No secret key patterns (`sk_live_`, `sk_test_`, `AKIA`, etc.) were found in any source file under `src/`.

## What's at Risk

- **Discord Bot Token**: An attacker with this token can impersonate the bot — send DMs to all users, read all channels the bot has access to, and potentially take admin actions if the bot has elevated permissions.
- **Supabase Service Role Key**: Bypasses Row Level Security entirely. An attacker with this key can read/write/delete any data in the database without restriction.

## What's Already Secure

- `.env` is properly gitignored
- Server-only secrets use the correct `$env/static/private` import path (SvelteKit will refuse to bundle these into client code)
- `.env.example` has only placeholder values
- No hardcoded secrets found in any source file

## Recommendations

1. **IMMEDIATE**: Rotate the `DISCORD_BOT_TOKEN` via Discord Developer Portal → regenerate token. The current token looks real and non-empty.
2. **IMMEDIATE**: Scan git history for any past accidental commits of `.env` (see plan).
3. Consider rotating the Supabase Service Role Key if there's any doubt about past exposure.
4. Add a pre-commit hook (e.g., `git-secrets` or `gitleaks`) to prevent future secret leaks.
