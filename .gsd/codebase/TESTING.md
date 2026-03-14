# TESTING.md — Testing Patterns

## Framework

- **Vitest** `^3.0.0` — test runner
- **@vitest/coverage-v8** `^3.0.0` — coverage via V8
- **@testing-library/svelte** `^5.2.0` — component testing
- **jsdom** `^26.0.0` — DOM simulation environment
- Config: `vitest.config.ts`

## Running Tests

```bash
npm test              # vitest watch mode (interactive)
npm run test:unit     # vitest run (single pass, no coverage)
npm run test:ci       # vitest run --coverage (CI mode)
npm run coverage      # vitest run --coverage (same as test:ci)
```

## File Location

Tests are **co-located** in `__tests__/` directories next to the source they test:

```
src/lib/__tests__/
  utils.test.ts
  admin-shared.test.ts
  deck-utils.test.ts

src/lib/server/__tests__/
  cart-types.test.ts
  search-utils.test.ts
  cart-service.test.ts
  card-identity.test.ts
  cart-store-optimizations.test.ts

src/routes/import/__tests__/
  deck-parsing.test.ts

src/routes/api/orders/__tests__/
  orders-phone.test.ts

src/routes/api/admin/exports/__tests__/
  exports.test.ts
```

**Global setup and shared mocks:**

```
tests/
  setup.ts              # Global setup (env mocking, etc.)
  mocks/
    supabase.ts         # Chainable Supabase query mock builder
    localStorage.ts     # Installable localStorage mock
```

Vitest picks up tests matching `src/**/*.{test,spec}.{js,ts}`.

## Test Structure

Standard BDD with Vitest:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('feature name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does the expected thing', () => {
    expect(myFunction(input)).toBe(expectedOutput)
  })

  it('handles edge case', () => {
    expect(() => myFunction(badInput)).toThrow()
  })
})
```

## Mocking

### Module mocking with `vi.mock`

```typescript
vi.mock('$env/static/public', () => ({
  PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  PUBLIC_SUPABASE_ANON_KEY: 'test-key'
}))

vi.mock('$app/environment', () => ({ browser: false, dev: true }))

vi.mock('$lib/server/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ isAdmin: true })
}))
```

### Supabase mock builder (`tests/mocks/supabase.ts`)

Chainable mock that mimics Supabase query builder:

```typescript
import { buildSupabaseMock } from '../../../tests/mocks/supabase'

const mockSupabase = buildSupabaseMock({
  cards: [createMockCard({ id: '1', name: 'Black Lotus' })]
})
// Supports chained: .from(...).select(...).eq(...).single() etc.
```

### Local state mocking

```typescript
import { installLocalStorageMock } from '../../../tests/mocks/localStorage'
installLocalStorageMock() // Adds working localStorage to jsdom
```

### Test factories

Create consistent test data with factory helpers:

```typescript
function createMockCard(overrides?: Partial<Card>): Card {
  return { id: 'uuid', name: 'Test Card', price: 1.0, ...overrides }
}

function createMockCartItem(overrides?: Partial<CartItem>): CartItem {
  return { id: 'uuid', card_id: 'uuid', quantity: 1, ...overrides }
}
```

## What's Tested

### Well covered

- `src/lib/utils.ts` — price formatting, URLs, slugging, image URLs, serial parsing/sorting
- `src/lib/admin-shared.ts` — admin ID checks, status config, transition rules
- `src/lib/deck-utils.ts` — deck text parsing
- `src/lib/server/cart-types.ts` — cart type logic
- `src/lib/server/search-utils.ts` — search utilities
- `src/lib/server/card-identity.ts` — identity matching
- `src/lib/server/cart-service.ts` — cart merge/creation logic
- `src/routes/import/` — deck parsing flows
- `src/routes/api/orders/` — phone/PayPal validation
- `src/routes/api/admin/exports/` — export endpoint (auth, headers, cleanup)

### Not covered (API routes)

- `src/routes/api/cart/**`
- `src/routes/api/admin/orders/**`
- `src/routes/api/admin/inventory/**`
- `src/routes/auth/callback/**` (no auth redirect tests)
- Most `+page.server.ts` loaders

## Coverage Configuration

Defined in `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: [
    'src/lib/utils.ts',
    'src/lib/admin-shared.ts',
    'src/lib/deck-utils.ts',
    'src/lib/server/cart-types.ts',
    'src/lib/server/search-utils.ts',
  ],
  thresholds: {
    statements: 80,
    branches: 80,
    functions: 90,
    lines: 80,
  }
}
```

**Note:** Coverage include is explicitly scoped to 5 modules. Routes and services are not in the coverage include list, even if they have test files.

Coverage output: `coverage/` (HTML readable via `coverage/index.html`)

## Notes on Testing Approach

- **No MSW** (Mock Service Worker) — external API calls are mocked at the module level with `vi.mock`
- **No component integration tests** found — only unit tests for logic modules
- **No end-to-end tests** — no Playwright or Cypress
- Some test files contain TODO comments indicating planned but unwritten assertions (`exports.test.ts:381`, `:389`)
