# INTEGRATIONS.md — External Integrations

## Supabase (Primary Backend)

**Role:** Database (PostgreSQL), Auth, Storage
**Client setup:**

- Browser + server clients: `src/lib/supabase.ts`
- Request lifecycle wiring: `src/hooks.server.ts`
- Admin/service-role client: `src/lib/server/admin.ts`

**Auth methods:**

- Email/password (`signInWithPassword`, `signUp`)
- OAuth: Google (`provider: 'google'`), Discord (`provider: 'discord'`)
- Identity linking: `auth.linkIdentity(...)`, `auth.unlinkIdentity(...)`
- Callback handler: `src/routes/auth/callback/+server.ts`

**Database tables observed:**

- `cards` — card catalog
- `users`, `admins` — user/auth profiles
- `orders`, `order_items`, `order_status_history`, `addresses` — ordering
- `group_buy_config` — configuration/pricing
- `notifications`, `notification_templates`, `notification_preferences`
- `sync_duplicate_alerts` — sync admin alerts
- `gphoto_url_cache` — media URL cache

**Schema management:**

- Migrations: `supabase/migrations/`
- Generated types: `src/lib/server/database.types.ts` (via `npm run db:generate`)

---

## Discord API (REST v10)

**Role:** User notification delivery (DMs)
**Endpoints used:**

- `POST https://discord.com/api/v10/users/@me/channels` — open DM channel
- `POST https://discord.com/api/v10/channels/{id}/messages` — send message
  **Auth:** `DISCORD_BOT_TOKEN` env variable
  **Implementation:** `src/lib/server/notifications/discord.ts`
  **Orchestration:** `src/lib/server/notifications/service.ts`

---

## Moxfield API

**Role:** Deck import source
**Endpoints:**

- `https://api2.moxfield.com/v3/decks/all/{publicId}`
- `https://api2.moxfield.com/v2/decks/all/{publicId}`
- `https://api2.moxfield.com/v2/decks/all/{publicId}/export?exportId=...`
  **Implementation:** `src/routes/api/import/deck/+server.ts`
  **Debug script:** `scripts/test-moxfield.mjs`

---

## Archidekt API

**Role:** Deck import source
**Endpoint:** `https://archidekt.com/api/decks/{deckId}/`
**Implementation:** `src/routes/api/import/deck/+server.ts`

---

## Google Sheets (Published CSV)

**Role:** Card inventory data feed
**Access:** Published CSV export URL (hardcoded in sync endpoints)
**Files:**

- `scripts/sync-cards.ts`
- `src/routes/api/admin/inventory/sync/+server.ts`
- `src/routes/api/admin/inventory/resync-images/+server.ts`

---

## Google Photos

**Role:** Card image URL resolution
**Pattern:** Fetches share pages (`photos.google.com`, `photos.app.goo.gl`), extracts direct `lh3.googleusercontent.com` CDN URLs
**Files:**

- `src/lib/server/gphoto-converter.ts` — converter + caching
- `scripts/convert-gphoto-urls.ts` — bulk conversion script

---

## Scryfall (CDN assets)

**Role:** Card image and mana symbol URLs
**Usage:** URL generation only (no API auth)

- Card images: `https://cards.scryfall.io/...`
- Mana symbols: `https://svgs.scryfall.io/card-symbols/...`
  **Files:**
- `src/lib/utils.ts` — URL helpers
- `src/lib/components/icons/ManaIcon.svelte` — mana icon display

---

## 17track

**Role:** Shipment tracking links
**Usage:** Link generation only (`https://www.17track.net/?nums=...` / `t.17track.net` format)
**Files:**

- `src/lib/utils.ts`
- `src/routes/api/admin/orders/[id]/notify/+server.ts`

---

## Vercel

**Role:** Deployment platform
**Config:** `@sveltejs/adapter-vercel ^5.4.0`, runtime `nodejs22.x`
**Config file:** `svelte.config.js`

---

## Integration Architecture Notes

- All external API calls are **server-side only** (no API keys exposed to client)
- Supabase client is request-scoped (created fresh in `hooks.server.ts` per request)
- Service-role admin Supabase client (`createAdminClient()`) used for RLS bypass in admin and guest-cart flows — **should not be used in public endpoints**
- No webhook receivers implemented currently
- PayPal and Resend integrations declared in `.env.example` but **not yet implemented** in source
