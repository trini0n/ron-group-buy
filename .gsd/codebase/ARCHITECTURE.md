# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** SSR-first SvelteKit Layered Monolith on Supabase

**Key Characteristics:**
- Server-side rendering via SvelteKit file-based routing; every page has a co-located `+page.server.ts` that loads and guards data before rendering
- Supabase as the single data store: typed end-to-end via `database.types.ts`, accessed through both anon (user-scoped RLS) and service-role (admin, bypasses RLS) clients
- Thin REST API layer (`src/routes/api/`) consumed by browser-side Svelte stores; heavy domain logic lives in `src/lib/server/` service classes rather than in route handlers
- Admin access enforced at two levels: hardcoded Discord IDs (`admin-shared.ts`) for bootstrap safety, and a database `admins` table for runtime management, unified by `isAdmin()` in `src/lib/server/admin.ts`
- Svelte 5 runes used throughout the client (`$state`, `$props`, `.svelte.ts` stores); no client router or separate SPA framework

## Layers

**Request Bootstrap:**
- Purpose: Create per-request Supabase client and resolve authenticated user before any loader runs
- Location: `src/hooks.server.ts`
- Contains: SvelteKit `handle` function; Supabase server client factory; `safeGetSession` helper using `getUser()` (server-round-trip validation, not just JWT decode)
- Depends on: `$lib/supabase.ts`, `@supabase/ssr`
- Used by: All downstream `+page.server.ts`, `+layout.server.ts`, and `+server.ts` files via `event.locals`

**Layout Data Layer:**
- Purpose: Load shared context once per navigation for all pages; enforce admin-area routing guard
- Location: `src/routes/+layout.server.ts`, `src/routes/admin/+layout.server.ts`
- Contains: Active `group_buy_config` fetch; user profile + admin flag resolution; card-type price fetch; admin dashboard stats
- Depends on: `$lib/server/admin.ts`, `$lib/server/pricing.ts`, `event.locals.supabase`
- Used by: All pages (data returned as layout `data` prop)

**Page Server Layer:**
- Purpose: Fetch page-specific data server-side; enforce auth/redirect guards; provide initial SSR state
- Location: `src/routes/**/*+page.server.ts`
- Contains: SvelteKit `load` functions; `throw redirect(303, ...)` guards; Supabase queries; in-memory TTL caches (home page cards/sets); checkout validation
- Depends on: `event.locals`, `$lib/server/` services
- Used by: Corresponding `+page.svelte` (receives returned data as `data` prop)

**REST API Layer:**
- Purpose: Provide JSON endpoints for client-side mutations and reads without full page navigations
- Location: `src/routes/api/**/*+server.ts`, `src/routes/auth/**/*+server.ts`
- Contains: HTTP handlers (`GET`, `POST`, `PATCH`, `DELETE`) for cart, orders, admin operations, deck import, profile management, pricing; OAuth callback handler
- Depends on: `$lib/server/cart-service.ts`, `$lib/server/admin.ts`, `$lib/server/notifications/`, `event.locals`
- Used by: Client State Layer (`cartStore`), admin pages for live mutations

**Service Layer:**
- Purpose: Domain business logic, decoupled from SvelteKit HTTP concerns
- Location: `src/lib/server/`
- Contains: `CartService` class, `NotificationService` class, `admin.ts`, `pricing.ts`, `user-profile.ts`, `card-identity.ts`, `export-builder.ts`, `export-storage.ts`, `search-utils.ts`, `gphoto-converter.ts`, `logger.ts`
- Depends on: Supabase clients (injected), `$env` variables, `ExcelJS`
- Used by: Page Server Layer and REST API Layer

**Client State Layer:**
- Purpose: Manage browser-side reactive state that must persist across navigation without full server round-trips
- Location: `src/lib/stores/cart.svelte.ts`, `src/lib/hooks/is-mobile.svelte.ts`
- Contains: Svelte 5 runes-based `cartStore` singleton with `localStorage` persistence and server sync; `IsMobile` reactive media query hook; `request-queue.ts` for serialised cart operations
- Depends on: REST API Layer (via `fetch`), `$app/environment` (browser guard)
- Used by: Presentation Layer

**Shared Definitions Layer:**
- Purpose: Types, constants, and utility functions safe to use on both client and server
- Location: `src/lib/server/types.ts`, `src/lib/server/cart-types.ts`, `src/lib/admin-shared.ts`, `src/lib/deck-utils.ts`, `src/lib/utils.ts`, `src/lib/data/countries.ts`, `src/lib/auth/errors.ts`
- Contains: TypeScript type aliases from `database.types.ts`; order-status config; admin Discord IDs; card parsing utilities; auth error catalog
- Depends on: Nothing (no server-only or browser-only imports)
- Used by: All layers

## Data Flow

**Page Request (authenticated user):**
1. Browser requests a route (e.g., `/checkout`)
2. `hooks.server.ts` `handle` creates a Supabase server client on `event.locals`; calls `getUser()` to verify the session; stores `user`/`session` on `event.locals`
3. Root `+layout.server.ts` `load` runs: fetches `group_buy_config`, user profile (name, avatar, discord_id), admin flag, and card-type prices; returns all as layout data available to every child route
4. Page `+page.server.ts` `load` runs with `locals`; may `throw redirect(303, ...)` for unauthenticated users; performs page-specific Supabase queries; returns serialized page data
5. SvelteKit renders the layout + page Svelte components, injecting the merged server data as `data` prop
6. `+layout.svelte` `onMount` initialises the browser Supabase client to listen for auth-state changes and syncs the cart store

**Cart Mutation (client-side):**
1. User clicks "Add to Cart" on a card
2. `cartStore.addItem()` enqueues a request via `cartRequestQueue` (prevents concurrent version conflicts)
3. Queue executes `POST /api/cart` with `{ card_id, quantity, expected_version }`
4. `src/routes/api/cart/+server.ts` instantiates `CartService`; calls `addItem()`; returns updated cart
5. `cartStore` updates its Svelte reactive state from the response

**Auth Callback (OAuth/email link):**
1. Provider redirects to `/auth/callback?code=...`
2. `+server.ts` exchanges the code for a session via `locals.supabase.auth.exchangeCodeForSession`
3. `syncUserData()` upserts the user into `public.users` using admin client to bypass RLS
4. `checkForNewProviderConflict()` detects if a newly linked OAuth provider is already owned by another account
5. Redirects to the intended `next` path, or to `/profile/conflict` on conflict with provider details in query params

**Guest-to-User Cart Merge:**
1. User signs in; `+layout.svelte` detects `SIGNED_IN` auth event
2. `cartStore.checkMergeStatus()` calls `POST /api/cart/merge` in preview mode
3. If `requires_confirmation`, `CartMergeModal` is shown; otherwise auto-merges silently
4. `CartService.mergeCarts()` moves guest cart items into the user cart, respecting stock limits and resolving quantity conflicts

**State Management:**
- Server state is stateless per-request (Supabase queries execute on every request; the home page applies short TTL in-memory caches for cards and sets data)
- Client cart state lives in `cartStore` (Svelte 5 runes), backed by `localStorage` for guest persistence and synced to the server on mount and auth change
- Layout data (session, isAdmin, groupBuyConfig, cardPrices) is propagated as SvelteKit page data and available to all child routes without re-fetching

## Key Abstractions

**CartService:**
- Purpose: All cart CRUD — get/create carts, add/update/remove items, validate stock and prices, merge guest into user cart
- Examples: `src/lib/server/cart-service.ts`
- Pattern: Class with injected `SupabaseClient`; lazily fetches prices per instance; version-based optimistic concurrency on every mutation

**NotificationService:**
- Purpose: Send Discord DM notifications for order lifecycle events, respecting per-user preferences stored in `notification_preferences` table
- Examples: `src/lib/server/notifications/service.ts`, `src/lib/server/notifications/discord.ts`, `src/lib/server/notifications/templates.ts`
- Pattern: Class with injected Supabase client; reads user preferences before sending; template functions render message content

**Admin Guard (dual-layer):**
- Purpose: Restrict `/admin/**` routes and `/api/admin/**` endpoints to authorised admins only
- Examples: `src/lib/admin-shared.ts` (hardcoded IDs), `src/lib/server/admin.ts` (`isAdmin()`, `createAdminClient()`)
- Pattern: Hardcoded Discord IDs checked first (bootstrap safety), then DB `admins` table; admin Supabase client uses service-role key to bypass RLS for privileged reads/writes

**Database Type System:**
- Purpose: End-to-end TypeScript type safety from Supabase schema to application code
- Examples: `src/lib/server/database.types.ts` (generated), `src/lib/server/types.ts` (convenience aliases)
- Pattern: Generated types consumed via thin aliases; all Supabase queries typed through `SupabaseClient<Database>`

**Card Identity:**
- Purpose: Stable cross-reindex identity for cards using composite key (set_code, collector_number, card_name, is_foil, is_etched, language)
- Examples: `src/lib/server/card-identity.ts`
- Pattern: Deterministic key generation; used during inventory sync to match existing DB rows to incoming data and detect duplicates

**Export Builder:**
- Purpose: Generate Excel (.xlsx) exports of orders for admin fulfilment workflow
- Examples: `src/lib/server/export-builder.ts`, `src/lib/server/export-storage.ts`
- Pattern: ExcelJS workbook generation; files stored at `/tmp/exports` with JSON manifest; 12-hour TTL; promise-mutex (`manifestLock`) serialises concurrent manifest writes

## Entry Points

**Request Hook (`hooks.server.ts`):**
- Location: `src/hooks.server.ts`
- Triggers: Every HTTP request to the SvelteKit server
- Responsibilities: Creates per-request Supabase server client; verifies user session via `getUser()` (avoids stale JWT trust); stores `supabase`, `session`, `user`, and `safeGetSession` on `event.locals`; filters Supabase response headers through serialization allow-list

**Root Layout Load (`+layout.server.ts`):**
- Location: `src/routes/+layout.server.ts`
- Triggers: Every page navigation (server-side)
- Responsibilities: Fetches active `group_buy_config`; resolves admin status; loads user profile; fetches current card-type prices; returns all as layout data available to every page

**Root Layout Component (`+layout.svelte`):**
- Location: `src/routes/+layout.svelte`
- Triggers: App mount in the browser
- Responsibilities: Subscribes to Supabase auth state changes; syncs cart on login/logout/token refresh; triggers `CartMergeModal` when login reveals a mergeable guest cart; conditionally renders `Header`, `Footer`, `GroupBuyBanner` (suppressed on `/admin` and `/auth` paths)

**Admin Layout Guard (`/admin/+layout.server.ts`):**
- Location: `src/routes/admin/+layout.server.ts`
- Triggers: Any request under `/admin/`
- Responsibilities: Redirects unauthenticated users to login; calls `isAdmin()`; fetches dashboard stats (orders by status, total users, card counts, out-of-stock count); redirects non-admins to `/?error=unauthorized`

## Error Handling

**Strategy:** SvelteKit `error()` / `redirect()` helpers for HTTP-layer errors; structured JSON error objects for API endpoints; structured `logger` utility for server-side observability; Sonner toast notifications for user-facing runtime errors

**Patterns:**
- Server load functions use `throw redirect(303, '/auth/login?redirectTo=...')` for auth-required routes; the `redirectTo` param is encoded so users land back on the intended page after login
- API handlers use `throw error(400/403/404/500, message)` which SvelteKit serialises into JSON error responses
- `CartService` method failures throw plain `Error` objects; callers in route handlers wrap them with `error(500, ...)`
- OAuth identity conflicts produce a structured redirect to `/profile/conflict` with conflict details in query params; dedicated page renders resolution UI
- `AUTH_ERROR_CODES` enum in `src/lib/auth/errors.ts` maps error types to HTTP status codes and user-friendly messages
- `logger.error(context, message)` outputs JSON-structured logs (`{ timestamp, level, message, ...context }`) to stderr; `logger.debug` is suppressed in production
- `export-storage.ts` uses a promise-based mutex to serialise manifest writes and prevent race conditions in concurrent export requests

## Cross-Cutting Concerns

**Logging:** Structured JSON logger (`src/lib/server/logger.ts`); methods `debug` (dev-only), `info`, `warn`, `error`; context-first signature `logger.error({ orderId, error }, 'message')`

**Validation:** Input validated at the API boundary (required fields, numeric ranges, version checks for optimistic concurrency); Supabase RLS enforces row-level access as a second layer; TypeScript types serve as the compile-time contract; no runtime schema validation library (e.g. Zod) in use

**Authentication:** Supabase Auth with Discord OAuth as the primary provider; email/password as fallback; every request validated via `getUser()` server call in `hooks.server.ts`; guest sessions tracked by `guest_cart_id` cookie; admin access via Discord ID whitelist plus DB `admins` table; account linking/merging handled in `src/lib/auth/conflicts.ts`

---
_Architecture analysis: 2026-03-14_
