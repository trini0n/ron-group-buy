# FRONTEND_SECRETS Security Report

## Status: PASS

## Findings

### `$env/static/private` Import Audit

Searched all `.svelte` files and client-side code for `$env/static/private` imports. **Zero occurrences found** in any frontend file. SvelteKit will throw a build error if `$env/static/private` is imported in a `.svelte` component (client context), so this is also compiler-enforced.

### Environment Variables in Frontend

Public env vars exposed to the client (via `$env/static/public`) are intentionally public values:
- `PUBLIC_SUPABASE_URL` — project URL (public by design for anon access)
- `PUBLIC_SUPABASE_ANON_KEY` — anon key (public by design, restricted by RLS)
- `PUBLIC_APP_URL` — app base URL (non-sensitive)
- `PUBLIC_MOXFIELD_PROXY` — Cloudflare Worker proxy URL (non-sensitive)

None of these contain secret credentials.

### Server-Only Secrets

All sensitive keys are only accessible server-side:
- `SUPABASE_SERVICE_ROLE_KEY` — only in `src/lib/server/admin.ts` (server-side)
- `DISCORD_BOT_TOKEN` — only in `src/lib/server/notifications/discord.ts` (server-side)
- `PAYPAL_CLIENT_SECRET` — not used in any source file (not yet implemented)
- `RESEND_API_KEY` — not used in any source file (not yet implemented)
- `ADMIN_DISCORD_IDS` — accessed via `$env/dynamic/private` only in server code
- `CRON_SECRET` — referenced in `.env.example` but not yet used

### PayPal — No Client-Side Integration

No PayPal SDK or API calls found in any `.svelte` file. PayPal appears to be used only for invoice links (not live payment processing from the client).

### Discord — No Client-Side API

No Discord API calls found in `.svelte` files. The Discord bot communicates server-to-server only.

### Cloudflare Worker Proxy (import page)

In `src/routes/import/+page.svelte` line 334:
```javascript
const proxyUrl = `https://cors.bridged.cc/${apiUrl}`
```

This is a third-party CORS proxy for Moxfield search (not a secret). However, the `cors.bridged.cc` service is external and uncontrolled. This is a minor dependency risk but not a secrets issue.

## What's at Risk

Nothing currently. All secrets are server-side only.

## What's Already Secure

- SvelteKit's module system prevents `$env/static/private` from being bundled into client code
- Zero private env imports found in any client-side file
- Supabase anon key is intentionally public (restricted by RLS)
- Service role key only accessed in `src/lib/server/` directory

## Recommendations

1. No immediate action required.
2. Consider replacing `cors.bridged.cc` proxy with the Cloudflare Worker proxy (`PUBLIC_MOXFIELD_PROXY`) which is already configured for Moxfield requests — this removes the external dependency.
