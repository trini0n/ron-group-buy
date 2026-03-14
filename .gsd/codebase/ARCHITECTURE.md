# ARCHITECTURE.md — System Architecture

## Overview

**SvelteKit full-stack monolith** deployed on Vercel with Node.js 22 runtime.

- File-based routing in `src/routes/`
- **Hard server/client split** enforced by SvelteKit conventions
- **Supabase** as primary backend (PostgreSQL + Auth)
- Domain service layer in `src/lib/server/` — complex logic extracted from routes

## Architectural Layers

### 1. Request Bootstrap (`hooks.server.ts`)
- Creates request-scoped Supabase client → `locals.supabase`
- Resolves authenticated user/session via `safeGetSession` → `locals.user`, `locals.session`
- Passes both to all downstream loaders and endpoints
- Handles Supabase cookie/header management for auth token refresh

### 2. Layout Data Layer (`+layout.server.ts`)
- Root `src/routes/+layout.server.ts` loads shared context for all pages:
  - Session/user from `locals`
  - `group_buy_config` (pricing, open/close state)
  - User profile snippet
  - `isAdmin` flag
  - Card prices (`fetchPrices`)
- Admin `src/routes/admin/+layout.server.ts` enforces admin guard

### 3. Page Server Layer (`+page.server.ts`)
- Auth/redirect guards (`throw redirect(303, '/auth/login?...')`)
- DB reads for initial SSR page data
- Returns plain serializable objects to `+page.svelte`
- Some pages use `setHeaders(...)` for response caching
- Home route uses **streamed return**: `streamed.cardsData = Promise.all([...])`

### 4. API Endpoint Layer (`+server.ts`)
- All mutations handled here (not SvelteKit `actions`)
- Validates payload + authorization before executing
- Calls into domain services for complex logic
- Returns JSON for client `fetch` calls
- Located under `src/routes/api/**/+server.ts` and `src/routes/auth/*/+server.ts`

### 5. Domain Service Layer (`src/lib/server/`)
- `cart-service.ts` — cart/order creation, merge, identity resolution
- `pricing.ts` — dynamic card price strategy
- `card-identity.ts` — duplicate/identity matching
- `export-builder.ts` + `export-storage.ts` — file generation and retention
- `notifications/service.ts` — notification dispatch orchestration
- `notifications/discord.ts` — Discord DM transport
- `admin.ts` — admin guard helpers (`isAdmin`, `requireAdmin`, `createAdminClient`)
- `gphoto-converter.ts` — Google Photos URL conversion with cache

## Data Flow

### Read flow (page load)
```
Browser request (/checkout)
  → hooks.server.ts: attach locals.supabase + locals.user/session
  → +layout.server.ts: load shared config/prices/session
  → +page.server.ts: auth guard, DB queries → serialized page data
  → +page.svelte: renders from data prop
```

### Write flow (client mutation)
```
UI event in +page.svelte
  → fetch('/api/cart/[itemId]', { method: 'PATCH', body: ... })
  → +server.ts: validate payload + auth
  → CartService or direct supabase call
  → JSON response
  → Client updates local state / invalidates
```

### Cart flow (specialized)
```
cartStore ($state) → request-queue.ts (serialization)
  → /api/cart/** endpoints → cart-service.ts → Supabase
Guest carts: cookie guest_cart_id → anonymous cart in DB
Auth merge: guest cart claimed on login → merge with user cart
Optimistic versioning: expected_version sent with mutations for conflict detection
```

## Key Abstractions

### Types
- `src/lib/server/database.types.ts` — generated Supabase schema types
- `src/lib/server/types.ts` — domain types (`Card`, `PaginatedResult<T>`, etc.)
- `src/lib/server/cart-types.ts` — cart/order types
- `src/app.d.ts` — global `App.Locals` / `App.PageData` typings

### Stores (client)
- `src/lib/stores/cart.svelte.ts` — cart state with server sync, localStorage persistence, optimistic updates

### Utilities
- `src/lib/utils.ts` — shared UI/domain helpers (URL builders, formatting, sorting)
- `src/lib/deck-utils.ts` — deck parsing
- `src/lib/utils/request-queue.ts` — serializes concurrent async cart operations

## Server vs Client Boundary

### `+page.server.ts` (server only)
Used for: secure reads, redirects, auth gates, initial data
```typescript
export const load: PageServerLoad = async ({ locals, params, url, parent }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const { data } = await locals.supabase.from('orders').select('*');
  return { orders: data };
};
```

### `+page.svelte` (client + SSR render)
Used for: interactivity, local state, fetch-based mutations
```svelte
<script lang="ts">
  let { data } = $props();
  let loading = $state(false);
  async function handleAction() {
    await fetch('/api/orders', { method: 'POST', body: ... });
  }
</script>
```

### `+server.ts` (server only — API endpoint)
Used for: mutations, admin operations, external API proxying
```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  const adminCheck = await requireAdmin(locals);
  if (!adminCheck.isAdmin) throw error(403, 'Forbidden');
  // ...
  return json({ success: true });
};
```

### `+page.ts` (universal loader)
**Not used** in this codebase. All loaders are `+page.server.ts`.

## Form Actions
**Not used.** All mutations go through `fetch` → `+server.ts` API endpoints.

## Authorization Model

- `hooks.server.ts` verifies user via Supabase Auth on every request
- Admin checks via `src/lib/server/admin.ts`:
  - `isAdmin(locals)` — boolean check
  - `requireAdmin(locals)` — throws 403 if not admin
  - `createAdminClient()` — service-role client for RLS bypass
- Admin IDs hardcoded in `src/lib/admin-shared.ts` (tech debt — see CONCERNS.md)

## Streaming / Progressive Enhancement

- Home page (`src/routes/+page.server.ts`) uses SvelteKit streaming:
  ```typescript
  return { streamed: { cardsData: Promise.all([fetchCards(), fetchSets()]) } };
  ```
- Page component handles promise resolve state and renders skeleton UI

## Deployment

- Vercel adapter with Node.js 22 runtime
- No edge functions or serverless split — all server code runs in Node
- Export files written to `/tmp/` (ephemeral Vercel filesystem)
