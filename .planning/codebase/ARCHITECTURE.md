---
updated: 2026-06-11
focus: arch
---

# ARCHITECTURE.md — MTG Group Buy Web App

## Overview

A full-stack web storefront for Magic: The Gathering proxy card group buys. Customers browse a card catalog, manage a persistent cart, and place orders. Admins manage inventory, process orders, run group-buy exports, and receive notifications. The application is a SvelteKit monolith deployed to Vercel, backed by Supabase (PostgreSQL + Auth).

---

## System Overview

`
+------------------------------------------------------------------+
|                       Vercel Edge (CDN)                          |
|  Cache-Control: public, max-age=300, stale-while-revalidate=1800 |
+-------------------------------+----------------------------------+
                                | HTTPS
+-------------------------------v----------------------------------+
|              SvelteKit App (Node 22.x runtime)                   |
|                                                                  |
|  +---------------+   +-----------------+   +------------------+  |
|  |  SSR Pages    |   |  API Routes     |   |  Server Hooks    |  |
|  | (+page.server |   |  (+server.ts)   |   | (hooks.server.ts)|  |
|  |   .ts)        |   |                 |   |                  |  |
|  +-------+-------+   +--------+--------+   +--------+---------+  |
|          |                   |                      |             |
|          +-------------------+----------------------+             |
|                              |                                    |
|               +--------------v--------------+                     |
|               |   /server/* (services)  |                     |
|               | CartService, ExportBuilder  |                     |
|               | Notifications, Admin utils  |                     |
|               +--------------+--------------+                     |
+------------------------------+-----------------------------------+
                               | @supabase/ssr (anon) / service_role
+------------------------------v-----------------------------------+
|                 Supabase (PostgreSQL + Auth)                      |
|                                                                  |
| Tables: cards, carts, cart_items, orders, order_items, users,   |
|         addresses, admins, group_buy_config, card_type_pricing,  |
|         notifications                                            |
| RLS: enabled on all user-facing tables                           |
| Auth: Google + Discord OAuth                                     |
+------------------------------------------------------------------+
`

---

## Major Layers

### 1. Frontend Layer (Svelte 5 Components + SSR)

- **Framework**: SvelteKit 2 + Svelte 5 (runes syntax — \, \, \)
- **Styling**: Tailwind CSS 3 + shadcn-svelte component library (via its-ui)
- **Icons**: Lucide Svelte
- **Toast notifications**: svelte-sonner
- **Dark mode**: mode-watcher

All pages are SSR-first. Initial data is fetched in +page.server.ts / +layout.server.ts and passed as data props to Svelte components. Client-side interactivity (cart, filters, modals) uses Svelte 5 runes-based reactive state.

### 2. Backend Layer (SvelteKit Server)

- **Server hooks** (src/hooks.server.ts): Runs on every request. Creates the per-request Supabase server client (cookie-based session), attaches safeGetSession(), session, and user to event.locals.
- **Layout server loads**: Root layout fetches group_buy_config, user profile, admin status, and card prices on every page.
- **Page server loads**: Individual pages fetch their own data (cards, orders, inventory) via Supabase or the admin client.
- **API routes** (src/routes/api/**): SvelteKit +server.ts files handling JSON REST endpoints for cart operations, import search, order actions, admin operations.
- **Service modules** (src/lib/server/*): Business logic — CartService, ExportBuilder, notification dispatch, pricing.

### 3. Database Layer (Supabase / PostgreSQL)

- **Supabase** hosts the PostgreSQL database with Row-Level Security (RLS) enabled.
- **Two client modes**:
  - **Anon client** (cookie-based, @supabase/ssr): Used for user-facing operations, respects RLS.
  - **Service role client** (createAdminClient()): Used only in server code for admin operations that bypass RLS (e.g., inventory sync, order management).
- **Migrations**: 24 sequential SQL migration files in supabase/migrations/, managed via Supabase CLI.
- **Types**: Auto-generated TypeScript types in src/lib/server/database.types.ts via 
pm run db:generate.

---

## Data Flow

### Page Load (SSR)
`
Browser Request
  --> hooks.server.ts (attach supabase + session to locals)
  --> +layout.server.ts (fetch groupBuyConfig, isAdmin, cardPrices)
  --> +page.server.ts (fetch page-specific data)
  --> Svelte component renders with data prop
  --> HTML streamed to browser
  --> Client hydrates (Svelte 5 runes activate)
`

### Card Catalog (Homepage)
`
+page.server.ts
  --> In-memory cache check (5-min TTL for cards/sets, 24h for Scryfall dates)
  --> createAdminClient() --> cards table (paginated, 1000 rows/batch)
  --> Scryfall API --> set release dates (external fetch, CDN-cacheable)
  --> Returns streamed promise --> browser renders progressively
  --> CardGrid.svelte / CardTableView.svelte -- client-side filter + pagination
`

### Cart Operations
`
Client action (add/remove/update)
  --> cart.svelte.ts (Svelte 5 store, optimistic local state)
  --> request-queue.ts (serialized fetch queue, prevents race conditions)
  --> POST /api/cart (or /api/cart/[itemId])
  --> CartService (server-side validation, Supabase write)
  --> Response updates local store
`

### Order Placement
`
/checkout page.server.ts (load: validate cart, get shipping)
  --> /api/orders POST
  --> CartService.validateCart() -- checks stock / prices
  --> Supabase atomic order function (place_order RPC)
  --> NotificationService --> email + Discord webhook
`

### Admin Operations
`
Admin page --> requireAdmin(locals) guard (Discord ID check)
  --> createAdminClient() (service role, bypasses RLS)
  --> Direct Supabase table operations
  --> /api/admin/** endpoints for AJAX actions
`

---

## Auth Architecture

### OAuth Providers
- **Google OAuth** and **Discord OAuth** — configured in Supabase Auth dashboard.
- Auth callback handled at /auth/callback (exchanges code for session, sets cookies).

### Session Management
- Sessions stored as HTTP-only cookies via @supabase/ssr.
- hooks.server.ts calls supabase.auth.getUser() (server-verified) on every request — not the client-side getSession() — to prevent session forgery.
- event.locals.user and event.locals.session set globally for all routes.

### Admin Authorization
Two-tier admin check in src/lib/server/admin.ts:
1. **Hardcoded super-admins**: Discord IDs from ADMIN_DISCORD_IDS env var (comma-separated). Checked first.
2. **Database admins**: dmins table — Discord IDs stored. Checked second via service role client.
3. **Emergency UUID fallback**: ADMIN_EMERGENCY_UUIDS env var for accounts without Discord.

equireAdmin(locals) throws 401 (unauthenticated) or 403 (authenticated but not admin). The admin layout server (/admin/+layout.server.ts) calls this on every admin page load — redirects to home on failure.

### Cart Sessions (Guest + Authenticated)
- **Guest carts**: Identified by guest_id (UUID stored in a cookie). Cart persists across unauthenticated sessions.
- **Auth login**: Triggers cart merge flow. CartService.mergeGuestCart() combines guest + user carts with conflict resolution and a preview modal (CartMergeModal.svelte).

---

## Key Design Patterns

### 1. Server-Side Caching (In-Memory)
+page.server.ts (homepage) maintains module-level cache objects for the full card list (5-min TTL) and Scryfall set dates (24h TTL). Cache invalidation on deploy. Avoids repeated DB round-trips for the catalog.

### 2. Streaming SSR (streamed)
Homepage uses SvelteKit's streaming feature — returns { streamed: { cardsData: Promise<...> } } so the HTML shell renders immediately while card data loads in the background.

### 3. Cart Request Queue
src/lib/utils/request-queue.ts — a serialized async queue preventing concurrent cart mutation races. All cart API calls flow through this queue on the client.

### 4. Optimistic UI (Cart Store)
src/lib/stores/cart.svelte.ts — Svelte 5 runes store. Applies local state changes immediately for instant UI feedback, then reconciles with server response.

### 5. Service Role Isolation
Admin operations always use createAdminClient() (service role key). User-facing operations always use the anon client from event.locals.supabase. The two are never mixed in the same code path.

### 6. Type-Safe Database Access
database.types.ts (generated) aliased in $lib/server/types.ts as Card, Order, CartItem, etc. All DB operations are fully typed end-to-end.

### 7. Card Identity System
src/lib/server/card-identity.ts — cards are uniquely identified by set_code + collector_number + card_type (the "identity"). Used for cart deduplication, order snapshots, and the new card checker feature.

### 8. Dual Pricing (DB + Hardcoded Fallback)
Prices fetched from card_type_pricing table via etchPrices(). Falls back to hardcoded FALLBACK_PRICES constants if the DB is unavailable. Identical fallback values kept in sync between src/lib/server/pricing.ts and src/lib/utils.ts.

---

## Route Structure

`
/ (homepage)
  +-- Card catalog with filters, pagination, grid/table views
  +-- SSR + streaming, 5-min CDN cache
  +-- URL-encoded filter state (?q=, ?sets=, ?colors=, ?price=, etc.)

/auth/
  +-- /login          -- OAuth sign-in page
  +-- /signup         -- Email sign-up
  +-- /logout         -- Sign-out action
  +-- /callback       -- OAuth callback (Supabase code exchange)
  +-- /forgot-password
  +-- /reset-password

/cards/[serial]       -- Individual card detail page by serial (e.g. N-001)

/card/[setCode]/[collectorNum]
                      -- Card detail by set code + collector number

/cart/                -- Cart page (SSR + client cart store)
/checkout/            -- Checkout flow (address, shipping, order review)

/orders/              -- Customer order history list
/orders/[id]          -- Single order detail

/import/              -- Deck import (Moxfield/Archidekt paste, card search)
/profile/             -- User profile + address management
/account/             -- Account settings

/admin/               -- Admin dashboard (requires admin auth)
  +-- /inventory      -- Card inventory list + stock toggle + search
  +-- /orders         -- All orders + status management
  +-- /orders/[id]    -- Single order detail + status transitions
  +-- /users          -- User list + management
  +-- /settings       -- Group buy config, pricing, notifications
      +-- /notifications
      +-- /pricing

/api/cart/
  +-- GET/POST        -- Cart read/create/add
  +-- /[itemId]       -- Update/remove single item
  +-- /bulk           -- Bulk add (deck import)
  +-- /validate       -- Validate cart before checkout
  +-- /merge          -- Guest to user cart merge
  +-- /checkout-session

/api/orders/          -- Customer order creation + read
  +-- /[id]
  +-- /bulk-status
  +-- /bulk-tracking

/api/import/
  +-- /deck           -- Parse + match decklist
  +-- /search         -- Card search for deck import

/api/profile/         -- Profile update + address management
  +-- /addresses
  +-- /auth
  +-- /notifications
  +-- /password

/api/admin/inventory/
  +-- /sync           -- Sync cards from MASTER CSV
  +-- /resync-images  -- Refresh Google Photos image cache
  +-- /bulk           -- Bulk stock toggle
  +-- /check-new      -- New card checker (missing card detection)

/api/admin/orders/
  +-- /[id]           -- Update order status
  +-- /bulk-status    -- Bulk status update
  +-- /bulk-tracking  -- Upload tracking numbers

/api/admin/exports/
  +-- /groupbuy       -- Group buy Excel export
  +-- /order          -- Single order export

/api/admin/users/     -- User management
/api/admin/pricing/   -- Card type price management
/api/admin/config/    -- Group buy config management
/api/admin/sync-alerts/
/api/admin/templates/ -- Notification templates
`

---

## API Design

- **Format**: JSON REST. All endpoints respond with JSON (errors as { error: string }).
- **Auth enforcement**: User-facing APIs check locals.user. Admin APIs call equireAdmin(locals) at the top of every handler.
- **HTTP verbs**: GET (read), POST (create/action), PATCH (partial update), DELETE (remove).
- **No versioning prefix** — all routes under /api/.
- **Cart operations** use the CartService class (instantiated per-request with the anon supabase client).
- **Admin operations** use createAdminClient() (service role).

---

## State Management

| State                  | Location                              | Mechanism                   |
|------------------------|---------------------------------------|-----------------------------|
| Auth session           | locals.session / locals.user        | SvelteKit server locals     |
| Cart items             | src/lib/stores/cart.svelte.ts       | Svelte 5 runes (\)  |
| Cart (server)          | carts / cart_items tables         | Supabase DB                 |
| Page data              | +page.server.ts data prop         | SSR load + serialization    |
| Card catalog cache     | Module-level in +page.server.ts     | In-memory, per-process      |
| URL filter state       | Browser URL query params              | URL search params           |
| Admin UI state         | Local Svelte component state          | Svelte 5 runes              |
| Toast notifications    | svelte-sonner toast queue           | Client-side only            |
| Mobile breakpoint      | src/lib/hooks/is-mobile.svelte.ts   | Svelte 5 derived state      |

No global client-side stores beyond the cart. All other data flows from SSR data props.

---

## External Integrations

| Service       | Usage                                                      |
|---------------|------------------------------------------------------------|
| Supabase Auth | OAuth (Google, Discord), session management                |
| Scryfall API  | Set release date lookup (cached 24h)                       |
| PayPal        | Manual invoice flow (admin sends invoices out-of-band)     |
| Discord       | Webhook notifications on order events                      |
| Google Photos | Card image hosting (URLs cached in on_image_url column) |
| ExcelJS       | Group-buy and order Excel export generation                |
