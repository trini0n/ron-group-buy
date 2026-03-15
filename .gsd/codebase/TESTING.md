# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Runner:**
- Vitest `^3.0.0`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` (globals enabled — no explicit import needed)

**Run Commands:**
```bash
npm run test              # Run all tests (watch mode)
npm run test:unit         # Run once (vitest run)
npm run test:ci           # Run once with coverage
npm run coverage          # Coverage report only
```

## Test File Organization

**Location:**
- Co-located `__tests__/` subdirectory alongside the source module being tested
- Top-level `tests/` is for shared setup and mock factories only — NOT for test files

**Naming:**
- `<module>.test.ts` (e.g., `utils.test.ts`, `cart-service.test.ts`, `search-utils.test.ts`)

**Structure:**
```
src/
  lib/
    __tests__/
      utils.test.ts
      admin-shared.test.ts
    server/
      __tests__/
        cart-service.test.ts
        cart-types.test.ts
        cart-store-optimizations.test.ts
        search-utils.test.ts
        export-builder.test.ts
        card-identity.test.ts
  routes/
    import/
      __tests__/
        deck-parsing.test.ts
    api/
      orders/
        __tests__/
          orders-phone.test.ts
      admin/
        exports/
          __tests__/
            exports.test.ts
tests/
  setup.ts          # Global setup — SvelteKit env mocks
  mocks/
    supabase.ts     # Reusable Supabase mock factory
    localStorage.ts # Mock localStorage for store persistence tests
```

## Test Structure

**Suite Organization:**
```typescript
/**
 * Unit tests for src/lib/utils.ts
 * Tests all pure utility functions for card pricing, URLs, and formatting
 */

import { describe, it, expect } from 'vitest'
import { formatPrice, getCardPrice } from '../utils'

describe('formatPrice', () => {
  it('formats whole numbers with two decimal places', () => {
    expect(formatPrice(5)).toBe('$5.00')
  })

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })
})
```

**Patterns:**
- Each file opens with a JSDoc block summarising scope
- One top-level `describe` per exported function/class being tested
- Nested `describe` for sub-cases (e.g., `describe('CartService.addItems')`)
- `beforeEach(() => vi.clearAllMocks())` at suite level when mocks are used
- `beforeEach(() => vi.useFakeTimers())` / `afterEach(() => vi.useRealTimers())` for time-dependent tests

## Mocking

**Framework:** `vi` from Vitest

**Module-level mock (top of file):**
```typescript
vi.mock('$lib/server/admin', () => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn()
}))

// Import AFTER vi.mock so the mock is applied
import { requireAdmin, createAdminClient } from '$lib/server/admin'
```

**Spy on module function:**
```typescript
vi.spyOn(pricingModule, 'fetchPrices').mockResolvedValue(FALLBACK_PRICES)
```

**Chainable Supabase mock builder (inline pattern):**
```typescript
function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis()
  }
  return { from: vi.fn().mockReturnValue(chain), _chain: chain, ...overrides }
}
```

**What to Mock:**
- SvelteKit virtual modules (`$app/environment`, `$env/static/public`, `$env/static/private`) — mocked globally in `tests/setup.ts`
- External services/clients: Supabase, SvelteKit `json`/`error` helpers
- Internal module functions when testing in isolation (e.g., `fetchPrices`)
- Never mock the module under test

## Fixtures and Test Data

**Test Data — factory functions defined per test file:**
```typescript
// From src/lib/server/__tests__/search-utils.test.ts
function createMockCard(overrides: Partial<CardMatch> = {}): CardMatch {
  return {
    id: 'card-123',
    serial: 'N-001',
    card_name: 'Test Card',
    set_code: 'TST',
    card_type: 'Normal',
    is_in_stock: true,
    language: 'en',
    ...overrides
  }
}

// From src/lib/server/__tests__/cart-types.test.ts
function createMockCartItem(cardId: string, quantity: number): CartItem {
  return {
    id: `item-${cardId}`,
    cart_id: 'cart-123',
    card_id: cardId,
    quantity,
    price_at_add: 1.25,
    card_name_snapshot: 'Test Card',
    card_type_snapshot: 'Normal',
    is_in_stock_snapshot: true,
    added_at: new Date().toISOString()
  }
}
```

**Location:**
- Shared mock factories: `tests/mocks/supabase.ts`, `tests/mocks/localStorage.ts`
- Per-file helper factories: defined at top of test file (not exported), named `createMock*` or `make*`

## Coverage

**Requirements:**
- Statements: 80%
- Branches: 80%
- Functions: 90%
- Lines: 80%

**Configuration:** `vitest.config.ts` — `coverage.thresholds`

**Included files (explicit allowlist):**
- `src/lib/utils.ts`
- `src/lib/admin-shared.ts`
- `src/lib/deck-utils.ts`
- `src/lib/server/cart-types.ts`
- `src/lib/server/search-utils.ts`

**View Coverage:**
```bash
npm run coverage
# HTML report: coverage/index.html
```

## Test Types

**Unit Tests:**
- All tests are unit tests targeting pure functions, service classes, and API route handlers
- Tests run in jsdom environment; no real network or DB connections

**Integration Tests:**
- Not present — Supabase interactions fully mocked

**E2E Tests:**
- Not used (no Playwright or Cypress configured)

## Common Patterns

**Async Testing:**
```typescript
// Awaiting a resolved mock
chain.in.mockResolvedValue({ data: cards, error: null })
const result = await service.addItems(...)
expect(result).toBeDefined()

// Asserting a mock was called once
expect(fetchPricesSpy).toHaveBeenCalledTimes(1)
```

**Error Testing:**
```typescript
// From src/routes/api/orders/__tests__/orders-phone.test.ts
it('throws 400 if phoneNumber is missing', async () => {
  const mockRequest = {
    json: vi.fn().mockResolvedValue({
      items: validItems,
      paypalEmail: 'test@example.com'
      // phoneNumber missing
    })
  }
  await expect(
    POST({ request: mockRequest, locals: mockLocals } as any)
  ).rejects.toThrow('Phone number is required')
})
```

**Time-dependent Testing:**
```typescript
// From src/lib/server/__tests__/cart-types.test.ts
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

it('returns true for recently active cart', () => {
  vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  const lastActivity = new Date('2024-01-15T11:00:00Z').toISOString()
  expect(isCartFresh(lastActivity)).toBe(true)
})
```

**Testing HTTP error responses (SvelteKit `error()`):**
```typescript
vi.mock('@sveltejs/kit', () => ({
  json: vi.fn((data) => data),
  error: vi.fn((status, message) => {
    const err = new Error(message);
    (err as any).status = status;
    throw err;
  })
}))

it('should return 400 if order ID is missing', async () => {
  await expect(getSingleOrderExport({ params: { id: undefined }, locals: mockLocals } as any))
    .rejects.toMatchObject({ status: 400 })
})
```

---
_Testing analysis: 2026-03-14_
