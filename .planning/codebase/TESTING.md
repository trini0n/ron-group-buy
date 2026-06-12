---
updated: 2026-06-11
focus: quality — testing
---

# TESTING.md

## Overview

The project uses **Vitest** for unit and integration tests. There are no end-to-end (E2E) or Playwright tests. Coverage tooling is configured and reports are generated, but the stored HTML report (from February 2026) shows 0% because it was generated without running tests.

---

## Test Framework and Config

### Framework: Vitest 3.x

**Config file:** `vitest.config.ts`

```typescript
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/utils.ts',
        'src/lib/admin-shared.ts',
        'src/lib/deck-utils.ts',
        'src/lib/server/cart-types.ts',
        'src/lib/server/search-utils.ts'
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 90,
        lines: 80
      }
    }
  }
})
```

Key settings:
- **Test environment:** `jsdom` (simulates browser DOM for all tests)
- **Globals:** `true` — `describe`, `it`, `expect`, `vi` are available without import in test files (though tests import them explicitly for clarity)
- **SvelteKit plugin:** included so SvelteKit module aliases (`$lib`, `$app/*`, `$env/*`) resolve during tests
- **Coverage provider:** V8 (via `@vitest/coverage-v8`)
- **Coverage scope:** Explicitly limited to 5 specific files (not the entire `src/` tree)

### Global Test Setup: `tests/setup.ts`

```typescript
import { vi, beforeEach } from 'vitest'

// Mock SvelteKit environment
vi.mock('$app/environment', () => ({
  browser: false, dev: true, building: false, version: 'test'
}))

// Mock public env vars
vi.mock('$env/static/public', () => ({
  PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
}))

// Mock private env vars
vi.mock('$env/static/private', () => ({
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
}))

beforeEach(() => {
  vi.clearAllMocks()
})
```

All mocks are cleared before each test (`vi.clearAllMocks()`). SvelteKit environment variables and the `$app/environment` module are globally mocked.

---

## Test File Locations

All test files match the pattern `src/**/*.{test,spec}.{js,ts}` (from vitest config). Tests live in `__tests__/` directories co-located with the source they test.

```
tests/                              # Global setup and shared mocks
  setup.ts                          # Global Vitest setup
  mocks/
    localStorage.ts                 # Mock localStorage factory
    supabase.ts                     # Mock Supabase client factory

src/lib/__tests__/
  utils.test.ts                     # Tests for src/lib/utils.ts
  admin-shared.test.ts              # Tests for src/lib/admin-shared.ts

src/lib/server/__tests__/
  card-identity.test.ts             # Tests for src/lib/server/card-identity.ts
  cart-service.test.ts              # Tests for src/lib/server/cart-service.ts
  cart-store-optimizations.test.ts  # Tests for cart pricing logic
  cart-types.test.ts                # Tests for src/lib/server/cart-types.ts
  export-builder.test.ts            # Tests for utility functions used in exports
  search-utils.test.ts              # Tests for src/lib/server/search-utils.ts
  user-profile.test.ts              # Tests for src/lib/server/user-profile.ts

src/routes/api/admin/exports/__tests__/
  exports.test.ts                   # Tests for export API route

src/routes/api/orders/__tests__/
  orders-phone.test.ts              # Tests for orders POST endpoint validation

src/routes/import/__tests__/
  deck-parsing.test.ts              # Tests for src/lib/deck-utils.ts
```

**Total test files: 12**

---

## What Is Tested

### Unit Tests — Pure Functions (Majority of Tests)

| Test File | Functions Tested | Test Count (approx.) |
|---|---|---|
| `utils.test.ts` | `formatPrice`, `getCardPrice`, `getCardTypeFromSerial`, `getTrackingUrl`, `getScryfallImageUrl`, `isValidRonImageUrl`, `getRonImageUrl`, `getCardImages`, `getCardImageUrl`, `slugify`, `getCardUrl`, `getFinishLabel`, `getFinishBadgeClasses`, `getFrameEffectLabel`, `cn`, `parseCardSerial`, `compareSerials`, `groupAndSortOrderItems`, `sortOrdersByShippingAndDate` | ~70 |
| `admin-shared.test.ts` | `ORDER_STATUS_CONFIG`, `getNextStatuses` | ~8 |
| `cart-types.test.ts` | `generateCartHash`, `isCartFresh`, `CART_FRESHNESS_THRESHOLD_MS` | ~8 |
| `search-utils.test.ts` | `getCacheKey`, `isFoil`, `sortMatches` | ~10 |
| `export-builder.test.ts` | `getFrameEffectLabel`, `getFinishLabel` (via export context) | ~15 |
| `deck-parsing.test.ts` | `extractPrimaryType`, `parseDeckList`, `TYPE_ORDER`, `getNotFoundCards`, `formatCardForClipboard` | ~25 |

### Unit Tests — Service Classes (Mocked Dependencies)

| Test File | Class/Function | What Is Mocked |
|---|---|---|
| `cart-service.test.ts` | `CartService.addItems` | Supabase client (inline mock), `fetchPrices` spy |
| `cart-store-optimizations.test.ts` | Cart total logic (pure function extracted) | None — tests extracted logic directly |
| `user-profile.test.ts` | `ensureUserRow` | `$lib/server/admin`, `$lib/server/logger` |
| `card-identity.test.ts` | Card identity matching | TBD (file exists at 14.5KB) |

### Integration Tests — API Route Handlers

| Test File | Route | What Is Tested |
|---|---|---|
| `orders-phone.test.ts` | `POST /api/orders` | Zod validation — missing/empty `phoneNumber`, missing/empty `paypalEmail` |
| `exports.test.ts` | Admin exports route | TBD (file exists at 8.5KB) |

### Not Tested

- **Svelte components** — no component rendering tests (no `@testing-library/svelte` usage found in any test file, though the library is installed)
- **Route `+page.server.ts` load functions** — no server load function tests
- **`+layout.server.ts`** — not tested
- **`hooks.server.ts`** — not tested
- **Cart store (`cart.svelte.ts`)** — the Svelte 5 runes-based store itself is not tested; `cart-store-optimizations.test.ts` tests an extracted pure function copy of the total logic instead
- **Admin pages** — no tests for admin route logic
- **E2E / Playwright** — not configured

---

## Test Patterns Used

### Arrange-Act-Assert with `describe`/`it`/`expect`

The standard Vitest pattern is used throughout:

```typescript
describe('formatPrice', () => {
  it('formats whole numbers with two decimal places', () => {
    expect(formatPrice(5)).toBe('$5.00')
  })
})
```

### Helper Factory Functions

Each test file that needs complex objects defines a local factory function:

```typescript
function createMockCartItem(cardId: string, quantity: number): CartItem {
  return {
    id: `item-${cardId}`,
    cart_id: 'cart-123',
    card_id: cardId,
    quantity,
    price_at_add: 1.25,
    // ...
  }
}
```

```typescript
function createMockCard(overrides: Partial<CardMatch> = {}): CardMatch {
  return { id: 'card-123', serial: 'N-001', card_name: 'Test Card', ...overrides }
}
```

This pattern appears in: `cart-types.test.ts`, `search-utils.test.ts`, `cart-service.test.ts`, `user-profile.test.ts`.

### Mocking with `vi.mock` and `vi.spyOn`

Module-level mocking:

```typescript
vi.mock('$lib/server/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('$lib/server/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}))
```

Spy on specific exports:

```typescript
vi.spyOn(pricingModule, 'fetchPrices').mockResolvedValue(FALLBACK_PRICES)
```

### Chainable Supabase Mock Builder

`tests/mocks/supabase.ts` exports `createMockQueryBuilder` and `createMockSupabaseClient` for reusable Supabase mocking:

```typescript
const supabase = buildSupabaseMock()
supabase.from.mockImplementation((table: string) => {
  if (table === 'carts') return finalChain._chain
  return chain
})
```

Individual tests also build inline Supabase mocks using `vi.fn().mockReturnThis()` chains:

```typescript
const chain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null })
}
const supabase = { from: vi.fn().mockReturnValue(chain) }
```

### Fake Timers for Time-Dependent Logic

```typescript
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

it('returns false for cart older than threshold', () => {
  vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  const lastActivity = new Date('2024-01-14T11:00:00Z').toISOString()
  expect(isCartFresh(lastActivity)).toBe(false)
})
```

### Immutability Testing

Tests verify that sort/filter functions do not mutate the original array:

```typescript
it('does not mutate original array', () => {
  const original = [...items]
  sortOrdersByShippingAndDate(items)
  expect(items).toEqual(original)
})
```

### Boundary and Edge Case Coverage

Tests explicitly cover:
- `null`/`undefined` inputs
- Empty arrays and strings
- Threshold-exact values (e.g., cart freshness at exactly the TTL boundary)
- Null database values (e.g., `shipping_type: null`)

---

## Mock Infrastructure

### `tests/mocks/localStorage.ts`

A `Map`-backed mock `localStorage` with vitest spy functions. Provides `_getStore()` and `_setStore()` helpers for test assertions and setup.

```typescript
export function installMockLocalStorage(): MockLocalStorage {
  const mock = createMockLocalStorage()
  Object.defineProperty(globalThis, 'localStorage', { value: mock, writable: true })
  return mock
}
```

### `tests/mocks/supabase.ts`

Chainable Supabase mock with:
- All standard query builder methods (`select`, `insert`, `update`, `upsert`, `delete`, `eq`, `neq`, `in`, `order`, `limit`, `range`)
- Terminal methods (`single`, `maybeSingle`) resolve to configured response
- Builder itself is `thenable` for `await`
- `_setMockResponse(table, response)` helper for per-table configuration
- `_getQueryBuilder(table)` for assertions

---

## Coverage Configuration

### Instrumented Files (from vitest.config.ts)

Coverage is **only collected for these 5 files**:

| File | Total Statements |
|---|---|
| `src/lib/utils.ts` | ~320 |
| `src/lib/admin-shared.ts` | ~78 |
| `src/lib/deck-utils.ts` | ~101 |
| `src/lib/server/cart-types.ts` | ~124 |
| `src/lib/server/search-utils.ts` | ~(small) |

### Coverage Thresholds

| Metric | Required |
|---|---|
| Statements | 80% |
| Branches | 80% |
| Functions | 90% |
| Lines | 80% |

### Current Coverage Status

> **Warning:** The `coverage/` HTML report (dated 2026-02-04) shows **0%** across all metrics. This indicates the stored report was generated from a run where no tests were collected (all statement hit counts are 0). The coverage report does not reflect actual test runs.

To generate an accurate coverage report, run:

```bash
npm run coverage
# or
npm run test:ci
```

The vitest thresholds (80/80/90/80) will **fail the CI run** if not met.

---

## How to Run Tests

### Commands

| Command | What It Does |
|---|---|
| `npm test` | Vitest in watch mode (re-runs on file changes) |
| `npm run test:unit` | Single pass, no watch (`vitest run`) |
| `npm run test:ci` | Single pass with coverage report (`vitest run --coverage`) |
| `npm run coverage` | Same as `test:ci` |

### Expected Output Locations

| Output | Path |
|---|---|
| Coverage HTML | `coverage/index.html` |
| Coverage JSON | `coverage/coverage-final.json` |
| Terminal summary | stdout during `npm run test:ci` |

### Type Checking (Separate from Tests)

```bash
npm run check         # svelte-kit sync + svelte-check
npm run check:watch   # Same, watch mode
```

As of the last check run (`svelte-check-output.txt`), there are **2 TypeScript errors** and **11 warnings**:
- **2 errors**: `boolean | null` vs `boolean` mismatch in `src/routes/admin/settings/notifications/+page.svelte`
- **11 warnings**: `state_referenced_locally` in `CardItem.svelte`, `+page.svelte`, and card detail page

---

## Gaps in Test Coverage

| Area | Gap Description |
|---|---|
| **Svelte components** | No component rendering tests despite `@testing-library/svelte` being installed |
| **Cart store (`cart.svelte.ts`)** | The 643-line store is not directly tested; only an extracted pure function in a separate file covers total calculation |
| **Server load functions** | `+page.server.ts`, `+layout.server.ts`, and all route `load` functions are untested |
| **API routes** | Only `POST /api/orders` (phone validation) and admin exports have tests; most API routes have no tests |
| **Hooks** (`hooks.server.ts`) | Session setup logic is untested |
| **Coverage scope** | Only 5 files are in the coverage config — most of the codebase has no coverage tracking at all |
| **E2E tests** | No Playwright or Cypress; no browser automation tests |
| **Admin routes** | No tests for any admin page logic |
| **`card-identity.ts`** | Test file exists (`card-identity.test.ts`, 14.5KB) — covered, but not included in coverage config |
| **`user-profile.ts`** | Test file exists — covered, but not in coverage config |
| **`cart-service.ts`** | Test file exists — covered, but not in coverage config |
