# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**Card Data:**

- Scryfall CDN - Card image URLs and mana symbol SVGs; no API key required; URL construction only
  - SDK/Client: None (URL helpers in `src/lib/utils.ts`, `src/lib/components/icons/ManaIcon.svelte`)
  - Auth: None (public CDN)

**Deck Import:**

- Moxfield - Import decks into the group buy by Moxfield URL
  - SDK/Client: Native `fetch` in `src/routes/api/import/deck/+server.ts`; debug script `scripts/test-moxfield.mjs`
  - Auth: None (spoofed browser headers; no API key)
- Archidekt - Import decks into the group buy by Archidekt URL
  - SDK/Client: Native `fetch` in `src/routes/api/import/deck/+server.ts`
  - Auth: None (public API)

**Messaging:**

- Discord Bot API (REST v10) - Send order status DM notifications to users
  - SDK/Client: Native `fetch` in `src/lib/server/notifications/discord.ts`
  - Auth: `DISCORD_BOT_TOKEN` (private env var)

**Shipment Tracking:**

- 17track - Tracking link generation only (no outbound API calls)
  - SDK/Client: URL construction in `src/lib/utils.ts` and `src/routes/api/admin/orders/[id]/notify/+server.ts`
  - Auth: None

## Data Storage

**Databases:**

- Supabase (PostgreSQL)
  - Connection: `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` (public client) / `SUPABASE_SERVICE_ROLE_KEY` (admin client)
  - Client: `@supabase/supabase-js ^2.47.10` + `@supabase/ssr ^0.5.2`
  - Tables: `cards`, `users`, `admins`, `addresses`, `carts`, `cart_items`, `orders`, `order_items`, `order_status_history`, `group_buy_config`, `notifications`, `notification_templates`, `notification_preferences`, `sync_duplicate_alerts`, `gphoto_url_cache`, `card_type_pricing`, `checkout_sessions`, `cart_merge_history`
  - Migrations: `supabase/migrations/` (20 files); generated types at `src/lib/server/database.types.ts`

**File Storage:**

- Local filesystem (`/tmp/exports`) - Temporary server-side export files (.xlsx); TTL 12h; managed by `src/lib/server/export-storage.ts`
- Google Photos (lh3.googleusercontent.com CDN) - Card image hosting; URLs resolved from share links via `src/lib/server/gphoto-converter.ts`

**Caching:**

- In-memory LRU cache - Card search result caching in `src/routes/api/import/search/+server.ts` via `lru-cache ^11.0.2`
- In-memory TTL cache - Cards and sets page data cached in `src/routes/+page.server.ts` (5 min TTL; `Cache-Control: s-maxage=300, stale-while-revalidate=1800`)

## Authentication & Identity

**Auth Provider:**

- Supabase Auth
  - Implementation: Email/password (`signInWithPassword`, `signUp`) + OAuth providers (Google, Discord)
  - Session management: Cookie-based via `@supabase/ssr`; validated server-side with `auth.getUser()` in `src/hooks.server.ts`
  - Callback handler: `src/routes/auth/callback/+server.ts`
  - Identity linking/unlinking: `src/routes/api/profile/auth/[provider]/+server.ts`
  - Admin authorization: Discord ID allowlist in `src/lib/admin-shared.ts` + `admins` DB table; checked server-side via `isAdmin()` in `src/lib/server/admin.ts`

## Monitoring & Observability

**Error Tracking:**

- None detected

**Logs:**

- Structured logger in `src/lib/server/logger.ts`; verbose output gated behind `import.meta.env.DEV`

## CI/CD & Deployment

**Hosting:**

- Vercel - `@sveltejs/adapter-vercel ^5.4.0`; `nodejs22.x` runtime; configured in `svelte.config.js`

**CI Pipeline:**

- None detected (no `.github/workflows` or CI config observed)

## Environment Configuration

**Required env vars:**

- `PUBLIC_SUPABASE_URL` - Supabase project URL (used in both browser and server clients)
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key (browser client)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server admin client only; bypasses RLS)
- `DISCORD_BOT_TOKEN` - Discord bot token for sending DMs to users
- `PUBLIC_APP_URL` - Application base URL (used in notification links)
- `CRON_SECRET` - Shared secret to authenticate cron job requests to `src/routes/api/admin/exports/cleanup/+server.ts`

**Secrets location:**

- `.env` file (local development); Vercel environment variables (production)

## Webhooks & Callbacks

**Incoming:**

- `src/routes/auth/callback/+server.ts` - OAuth callback from Supabase (Discord/Google OAuth flow)
- `src/routes/api/admin/exports/cleanup/+server.ts` - Cron trigger endpoint; authenticated via `CRON_SECRET` header

**Outgoing:**

- Discord REST API - Bot-initiated DM channel creation and message delivery triggered by order status changes

---

_Integration audit: 2026-03-14_
