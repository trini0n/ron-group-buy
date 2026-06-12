---
updated: 2026-06-11
focus: integrations
---

# Integrations Map

## Overview

The group-buy SvelteKit app integrates with several external services:
**Supabase** (database + auth), **Google OAuth** and **Discord OAuth** (login providers),
a **Discord bot** (DM notifications), **PayPal** (invoice tracking, not payment processing),
**Google Photos** (card image URL conversion), **Moxfield** and **Archidekt** (deck import),
**Vercel** (hosting), and a **Google Apps Script** legacy system (predecessor order intake).

No payment processing SDK is wired in — PayPal appears only as an email/invoice link field.
Resend (email) is listed in `.env.example` but there is **no import or usage of the Resend SDK** anywhere in `src/`.

---

## 1. Supabase

### Client Setup

Two clients are created from `src/lib/supabase.ts`:

| Client | Factory | Package | Key Used | Context |
|---|---|---|---|---|
| Browser client | `createBrowserClient` | `@supabase/ssr` | `PUBLIC_SUPABASE_ANON_KEY` | Client-side Svelte components |
| Server client | `createServerClient` | `@supabase/ssr` | `PUBLIC_SUPABASE_ANON_KEY` | SvelteKit server routes, with cookie bridging |

An **admin/service-role client** is created in `src/lib/server/admin.ts`:

```ts
createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})
```

Used exclusively in server-side code for privileged operations that bypass Row Level Security (admin dashboard, user sync, notification dispatch).

### Session / Auth Middleware

`src/hooks.server.ts` creates a Supabase server client per request and attaches it to `event.locals.supabase`. On each request, it calls `supabase.auth.getUser()` (server-verified JWT check, not just session cookie) and sets `event.locals.user` and `event.locals.session`. Auth state is consumed by all server load functions.

### Database (PostgreSQL via Supabase)

TypeScript types are auto-generated via:
```
npm run db:generate   # supabase gen types typescript --local > src/lib/server/database.types.ts
```

Migrations live in `supabase/migrations/` (24 files, earliest `20260105`, latest `20260527`).

Key tables (inferred from queries across the codebase):

| Table | Purpose |
|---|---|
| `users` | User profiles — id, email, name, discord_id, discord_username, google_id, avatar_url, paypal_email, admin_notes, is_blocked |
| `admins` | Database-managed admin list (supplementing hardcoded `ADMIN_DISCORD_IDS`) |
| `orders` | Customer orders — status, tracking, paypal_invoice_url, group_buy_id, address |
| `order_items` | Per-card line items with identity fields (set, collector number, foil) |
| `carts` | Persistent server-side carts for authenticated users |
| `group_buy_config` | Active/inactive group buy periods with open/close windows |
| `card_type_pricing` | Per-card-type prices fetched at runtime (fallback hardcoded in `pricing.ts`) |
| `notifications` | Notification delivery log (pending/sent/failed per channel) |
| `notification_preferences` | Per-user Discord notification opt-in flags |
| `notification_templates` | Admin-editable message templates per type x channel |
| `sync_duplicate_alerts` | Alerts for card sync conflicts, resolved by admins |
| `gphoto_url_cache` | 30-day cache of Google Photos share URL to direct URL conversions |

### Row Level Security

RLS is applied to all user-facing tables. Migration `20260109000000_optimize_rls_policies.sql` and `20260211_fix_security_vulnerabilities.sql` refine policies. Service-role key bypasses RLS for admin operations.

### Realtime

No Supabase realtime subscriptions (`supabase.channel(...)`) were found in `src/`. The README mentions "Real-time Updates" as a feature, but the current implementation uses SvelteKit `invalidateAll()` triggered by `supabase.auth.onAuthStateChange` events. Stock availability is not pushed via websocket.

### Supabase Storage

No usage of `supabase.storage` was found. Card images are served as Google Photos direct URLs stored in the database.

### Edge Functions

No Supabase Edge Functions (`supabase/functions/`) are present. All server logic runs in SvelteKit API routes on Vercel.

---

## 2. Authentication

### Providers

Both OAuth providers are configured in Supabase Auth settings (not in code). Sign-in is initiated client-side:

```ts
// Google
supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/callback?next=...' } })

// Discord
supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: '/auth/callback?next=...' } })
```

Email/password sign-in is also supported via `signInWithPassword` (login page).

### Auth Flow

```
User clicks "Sign in with Google/Discord"
  -> Supabase redirects to provider OAuth page
  -> Provider redirects to GET /auth/callback?code=...
  -> Server exchanges code for session (supabase.auth.exchangeCodeForSession)
  -> syncUserData() upserts user row in `users` table (discord_id, google_id, avatar_url, name)
  -> Redirect to `next` param (default: /)
```

### Identity Linking

Logged-in users can link/unlink additional providers via:
- `supabase.auth.linkIdentity({ provider })` — triggers same OAuth callback with `action=link` param
- `supabase.auth.unlinkIdentity(identity)` — server-side unlink

Conflict detection runs at callback time: if the incoming provider identity already belongs to another user, the user is redirected with an error (`/auth/login?conflict=...`).

### Admin Authorization

Two tiers of admin access:
1. **Hardcoded super-admins**: Discord IDs listed in `ADMIN_DISCORD_IDS` env var (bootstrap/emergency)
2. **Database admins**: Discord IDs in the `admins` table (managed via admin UI)
3. **Emergency UUID fallback**: Supabase UUIDs in `ADMIN_EMERGENCY_UUIDS` (for non-Discord accounts)

`requireAdmin(locals)` / `isAdminRequest(locals)` guards are used at the top of admin API routes.

---

## 3. Discord Bot

**Package**: None (raw `fetch` calls to Discord REST API v10)
**File**: `src/lib/server/notifications/discord.ts`
**Endpoint base**: `https://discord.com/api/v10`

### Flow

1. Bot receives a Discord user ID (stored in `users.discord_id` at OAuth callback time)
2. `createDMChannel(discordUserId)` — POST to `/users/@me/channels` — opens a DM channel
3. `sendMessage(channelId, content, embed?)` — POST to `/channels/{id}/messages`

### Triggers

Notifications are dispatched by `NotificationService` (singleton per Supabase client) when:
- Order status changes (`order_status_change`)
- Tracking number added (`tracking_added`)
- Payment reminder sent (`payment_reminder`)

Templates are loaded from the `notification_templates` table with hardcoded fallbacks in `templates.ts`.

### Notification Preferences

Per-user opt-in stored in `notification_preferences` table. Defaults: all Discord notifications enabled. Admin can also trigger custom free-text DMs from the order detail page.

### Error Handling

- 403 -> user has DMs disabled or blocked the bot (logged, not retried)
- 429 -> rate limited (Retry-After header logged)
- Missing `DISCORD_BOT_TOKEN` -> silently skips, returns `success: false`

---

## 4. PayPal

**Usage type**: Reference/metadata only — **not a payment processing integration**

No PayPal SDK is installed. `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_MODE` appear in `.env.example` but are **never imported or used** anywhere in `src/`. The fields exist presumably for a future or removed invoice-verification feature.

What IS used:
- `users.paypal_email` — collected at checkout, stored in user row
- `orders.paypal_invoice_url` — admin manually pastes a PayPal invoice URL in the order detail page
- When status changes to `invoiced`, the notification template includes the user's PayPal email so they know where to look for the invoice

---

## 5. Resend (Email)

**Status**: Configured in `.env.example` but **not implemented**

`RESEND_API_KEY` is listed, but:
- No `resend` package in `package.json`
- No import of any email-sending library found in `src/`
- The `resend` keyword in checkout (`supabase.auth.resend(...)`) refers to Supabase's built-in verification email resend, not the Resend service

Email notifications are currently Discord-only. Resend appears to be planned/placeholder.

---

## 6. Google Photos

**Usage type**: Server-side URL conversion + database caching
**File**: `src/lib/server/gphoto-converter.ts`
**No SDK** — uses raw `fetch` to scrape the photos page

Card images in the admin's master sheet use Google Photos share links. The converter:
1. Checks `gphoto_url_cache` table for a non-expired cached result (30-day TTL)
2. If miss: fetches the share URL, extracts `lh3.googleusercontent.com/...` from page HTML
3. Normalizes to original resolution (`=w0` suffix)
4. Stores result in cache

SSRF guard: validates that the final URL hostname is `photos.google.com` or `lh3.googleusercontent.com` after any redirects.

Supported input formats:
- `https://photos.google.com/share/...`
- `https://photos.app.goo.gl/...` (short links)

---

## 7. Moxfield (Deck Import)

**Usage type**: Public API scrape (no API key, no SDK)
**File**: `src/routes/api/import/deck/+server.ts`
**Endpoint**: `POST /api/import/deck` with `{ url, source: 'moxfield' }`

The server impersonates a browser with Chrome-like headers and referrer spoofing. Multi-strategy fetch:

| Strategy | Endpoint | Result |
|---|---|---|
| 1 (primary) | `api2.moxfield.com/v3/decks/all/{id}` + export via `exportId` | Best — plain-text export |
| 2 (fallback) | `api2.moxfield.com/v3/decks/all/{id}` JSON boards | Direct JSON parsing |
| 3 (fallback) | `api2.moxfield.com/v2/decks/all/{id}` JSON boards | Older API fallback |
| Fail | — | Returns HTTP 422 with human-readable message to use paste mode |

Results cached in-memory with `LRUCache` (max 100 entries, 5-minute TTL).

---

## 8. Archidekt (Deck Import)

**Usage type**: Public API (no auth, no SDK)
**File**: `src/routes/api/import/deck/+server.ts`
**Endpoint**: `GET https://archidekt.com/api/decks/{id}/`

Standard browser headers used. No fallback strategy. Cards mapped by `categories` field to board type (Commander, Companion, Sideboard, etc.). Deduplicates by card name.

---

## 9. Google Apps Script (Legacy System)

**Location**: `docs/Ron/` — `.gs` files, **not deployed via this repo**

This is the **predecessor** to the SvelteKit web app. It is a standalone Google Apps Script system attached to a Google Spreadsheet. It still exists and functions independently.

### Architecture

```
User's copy of template spreadsheet (Google Sheets)
  -> Apps Script triggered by menu or checkbox
  -> HTTPS POST to admin's Google Apps Script Web App (doPost)
  -> Admin spreadsheet receives and stores submission
```

### Files

| File | Purpose |
|---|---|
| `Main.gs` | Menu registration, public wrappers |
| `Config.gs` | `BOOTSTRAP_URL` constant (points to admin web app) |
| `ConfigManager.gs` | Dynamic config fetch + 6-hour TTL cache |
| `Cart.gs` | Cart management, validation, submission logic |
| `DeckImport.gs` | Decklist parsing, card search against Library sheet |
| `EditHandlers.gs` | `onEdit` trigger routing (checkbox -> add to cart) |
| `AdminSubmission.gs` | HTTP POST to admin web app |
| `Utils.gs` | Shared utilities |

### Authentication

Token-based: admin generates a shared secret once (`setSecretOnce()`), distributes it to users. Each submission includes the token in the POST body. The admin web app validates it.

### Relationship to SvelteKit App

The GAS system and SvelteKit app are **parallel systems** — orders from the GAS system do not flow into Supabase automatically. The SvelteKit app has a `sync:cards` script (`npm run sync:cards`) that reads from a MASTER CSV (likely exported from the admin Google Sheet) to populate the Supabase `cards` table.

---

## 10. Vercel (Hosting)

**Package**: `@sveltejs/adapter-vercel ^5.4.0` (dev dependency)
**Config**: `svelte.config.js`

```js
adapter({ runtime: 'nodejs22.x' })
```

All SvelteKit server routes run as Vercel serverless functions on Node.js 22. No edge runtime. No Vercel-specific cron configuration found in source (`CRON_SECRET` in `.env.example` suggests Vercel crons are planned or partially configured).

---

## 11. Environment Variables

All variables from `.env.example`:

| Variable | Visibility | Purpose |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Public (browser) | Supabase project URL for both browser and server clients |
| `PUBLIC_SUPABASE_ANON_KEY` | Public (browser) | Supabase anonymous key for client-side and SSR queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Service role key — bypasses RLS; used by admin client |
| `PAYPAL_CLIENT_ID` | Server-only | Defined but **not used** in current code |
| `PAYPAL_CLIENT_SECRET` | Server-only | Defined but **not used** in current code |
| `PAYPAL_MODE` | Server-only | `sandbox` or `live` — defined but **not used** |
| `RESEND_API_KEY` | Server-only | Defined but **not used** — Resend not installed |
| `DISCORD_BOT_TOKEN` | Server-only | Bot token for sending DMs; absence disables notifications gracefully |
| `PUBLIC_APP_URL` | Public (browser) | Base URL (e.g. `http://localhost:5173`) — for redirect construction |
| `CRON_SECRET` | Server-only | Auth token for cron-triggered endpoints — defined but no matching handler found in current `src/` |
| `ADMIN_DISCORD_IDS` | Server-only | Comma-separated Discord snowflake IDs with hardcoded super-admin access |
| `ADMIN_EMERGENCY_UUIDS` | Server-only | Comma-separated Supabase UUIDs for emergency admin access (non-Discord accounts) |

---

## 12. Background Jobs / Webhook Patterns

### Cron Pattern (planned/partial)

`CRON_SECRET` in `.env.example` indicates Vercel Cron Jobs are anticipated. No active cron endpoint was found in the current `src/routes/api/` tree. Pattern when implemented: request includes `Authorization: Bearer <CRON_SECRET>` header; endpoint validates before executing.

### Sync Script

```
npm run sync:cards   # tsx scripts/sync-cards.ts
```

A Node.js script (run manually or in CI) that reads from a MASTER CSV and syncs card data into Supabase. Not a webhook — run on demand.

### Notification Dispatch

Triggered synchronously within API route handlers (e.g., order status update -> `NotificationService.send()` -> Discord DM). No background queue or job system — if the Discord API call fails, the error is logged and the HTTP response is still returned.

### No Webhooks Received

No inbound webhook endpoints were found (no PayPal IPN/webhook, no Stripe, no Discord gateway events).

---

## 13. Third-Party SDKs Summary

| Package | Version | Role |
|---|---|---|
| `@supabase/supabase-js` | `^2.47.10` | Core Supabase client (auth, database queries) |
| `@supabase/ssr` | `^0.5.2` | SSR-safe Supabase clients with cookie bridging |
| `supabase` | `^2.70.5` | CLI (devDep) — migrations, type generation |
| `@sveltejs/adapter-vercel` | `^5.4.0` | Vercel deployment adapter |
| `zod` | `^3.24.1` | Runtime schema validation for API request bodies |
| `lru-cache` | `^11.0.2` | In-memory LRU cache for deck import results |
| `csv-parse` | `^6.1.0` | Parsing MASTER CSV during card sync script |
| `exceljs` | `^4.4.0` | Excel export builder for admin order exports |
| `country-telephone-data` | `^0.6.3` | Country/phone code data for checkout address form |

No dedicated Discord SDK, PayPal SDK, or email SDK is installed. All Discord and PayPal interactions use raw `fetch`.
