# Phase 01 Research — Security Vulnerabilities

## Standard Stack

- SvelteKit `@sveltejs/kit` — `redirect()`, `error()`, `RequestHandler`
- `@supabase/supabase-js` — anon client via `locals.supabase`, service-role via `createAdminClient()`
- `src/lib/server/pricing.ts` — `fetchPrices(supabase)` + `getCardPrice(cardType, prices)` for authoritative price lookup

## Vulnerability Analysis

### 1. Open Redirect — `src/routes/auth/callback/+server.ts`

**Current flow:**

- Line 8: `const next = url.searchParams.get('next') ?? '/'` — unvalidated
- Line 24: `throw redirect(303, buildConflictRedirectUrl(conflict, next))` — forwards to conflict page
- Line 39: `throw redirect(303, next)` — direct redirect post-login

**Fix:** Sanitize `next` immediately after reading, before any use:

```typescript
const rawNext = url.searchParams.get('next') ?? '/'
const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
```

**Secondary hardening:** `src/routes/profile/conflict/+page.server.ts` line 14 — sanitize `returnTo` too since that page can be hit directly.

**Files:** `src/routes/auth/callback/+server.ts` (required), `src/routes/profile/conflict/+page.server.ts` (recommended hardening)

---

### 2. Client-Controlled Pricing — `src/routes/api/orders/+server.ts`

**Current flow:**

- Line 307: `unit_price: item.unitPrice` — from request body on order create
- Line 385: `unit_price: newItem.unitPrice` — from request body on merge path

**Authoritative source:** `src/lib/server/pricing.ts`

- `fetchPrices(supabase)` reads `card_type_pricing` table
- `getCardPrice(card.card_type, prices)` returns canonical price per card type
- Cart service already uses this: `cart_items.price_at_add` is a server-side snapshot of price

**Fix:** In both create and merge paths:

1. Load prices from DB: `const prices = await fetchPrices(locals.supabase)`
2. For each item, fetch card type: `const { data: card } = await locals.supabase.from('cards').select('card_type').eq('id', item.cardId).single()`
3. Compute: `const serverPrice = getCardPrice(card.card_type, prices)`
4. Use `serverPrice` instead of `item.unitPrice`

**Decision:** Use current `card_type_pricing` price (not `price_at_add` snapshot) — correct for an open group buy where prices are managed by admin.

**Files:** `src/routes/api/orders/+server.ts` only (pricing.ts unchanged, just imported)

---

### 3. Cleanup Fail-Open — `src/routes/api/admin/exports/cleanup/+server.ts`

**Current flow:**

- Line 8: `const cronSecret = process.env.CRON_SECRET || ''`
- Line 11: auth check conditional on truthy `cronSecret` → if env var missing, endpoint runs unauthenticated

**Fix:** Fail-closed pattern:

```typescript
const cronSecret = process.env.CRON_SECRET?.trim()
if (!cronSecret) {
  throw error(503, 'CRON_SECRET not configured')
}
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${cronSecret}`) {
  throw error(401, 'Unauthorized')
}
```

**Files:** `src/routes/api/admin/exports/cleanup/+server.ts` only

---

### 4. Service-Role in Public Search — `src/routes/api/import/search/+server.ts`

**Current flow:**

- Line 72: `const adminClient = createAdminClient()` — service-role client, bypasses RLS
- Lines 75+: runs card search queries with admin client

**RLS check:** Cards table has policy `"Cards are viewable by everyone" ... USING (true)` for SELECT — anon reads are fine.

**Fix:** Replace `createAdminClient()` usage with `locals.supabase` (already available in `RequestHandler` context):

```typescript
// Remove: import { createAdminClient } from '$lib/server/admin'
// Change: const adminClient = createAdminClient()
// To: use event.locals.supabase directly
```

**Files:** `src/routes/api/import/search/+server.ts` only

---

## Common Pitfalls

- Open redirect: Don't just check `startsWith('/')` — `//evil.com` also starts with `/`. Must check `!rawNext.startsWith('//')`.
- Pricing: Both create AND merge paths need the fix — easy to fix one and miss the other.
- Cleanup: Use `?.trim()` on env var — a whitespace-only value should also be treated as absent.
- Search: The supabase client from locals is `SupabaseClient`, same interface as admin client for reads. No type changes needed.

## Code Examples

### Sanitizing redirect target

```typescript
const rawNext = url.searchParams.get('next') ?? '/'
const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
```

### Server-side price lookup in order creation

```typescript
import { fetchPrices, getCardPrice } from '$lib/server/pricing'
// In POST handler:
const prices = await fetchPrices(locals.supabase)
const { data: card } = await locals.supabase.from('cards').select('card_type').eq('id', item.cardId).single()
const serverPrice = getCardPrice(card.card_type, prices)
```

### Fail-closed cron auth

```typescript
const cronSecret = process.env.CRON_SECRET?.trim()
if (!cronSecret) throw error(503, 'CRON_SECRET not configured')
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${cronSecret}`) throw error(401, 'Unauthorized')
```
