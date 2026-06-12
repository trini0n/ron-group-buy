---
updated: 2026-06-11
focus: quality — conventions
---

# CONVENTIONS.md

## Overview

Code style conventions for the `group-buy` SvelteKit project. The project targets Svelte 5 (runes API), strict TypeScript, Tailwind CSS via shadcn-svelte, and Supabase as the backend. Tooling enforces formatting via Prettier; linting via ESLint + typescript-eslint.

---

## TypeScript Usage Patterns

### Compiler Settings (tsconfig.json)

| Option | Value | Effect |
|---|---|---|
| `strict` | `true` | Full strict mode — enables `strictNullChecks`, `noImplicitAny`, etc. |
| `noUncheckedIndexedAccess` | `true` | Array/record access returns `T or undefined` — index results must be guarded |
| `noImplicitOverride` | `true` | Subclass overrides must be marked `override` |
| `noFallthroughCasesInSwitch` | `true` | All switch arms must break/return |
| `allowJs` / `checkJs` | `true` | JavaScript files are type-checked |
| `moduleResolution` | `bundler` | Vite-style module resolution |
| `resolveJsonModule` | `true` | JSON imports allowed |

### Type Definitions Pattern

**Database types are generated**, not hand-authored. The canonical type source is `src/lib/server/database.types.ts` (generated via `npm run db:generate`). Application types are thin aliases over the generated types:

```typescript
// src/lib/server/types.ts
import type { Database } from './database.types'

export type Card = Database['public']['Tables']['cards']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderStatus = Database['public']['Enums']['order_status']

// Extended relation types use intersection
export type CartItemWithCard = CartItem & { card: Card }
```

### Interface vs Type

- `interface` is used for structured object shapes (component props, service arguments, API request/response shapes)
- `type` is used for union types, aliases, and utility compositions
- Both styles appear in the codebase — no enforced preference

### Generic Patterns

Generics are used for cache entries and paginated results:

```typescript
interface CacheEntry<T> {
  data: T
  timestamp: number
}

interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}
```

### Null Handling

- `noUncheckedIndexedAccess` means array accesses return `T | undefined`; the non-null assertion `!` is used intentionally when the developer is certain the value exists (e.g., `items[0]!.id`)
- Supabase query results destructure as `{ data, error }` — error is always checked before using `data`
- Optional chaining (`?.`) and nullish coalescing (`??`) are the preferred guards

---

## Component Patterns (Svelte 5 Runes API)

The project uses **Svelte 5 runes** throughout. Legacy Svelte 4 patterns (`export let`, `$: reactive`, `$store`) are not used.

### Props Declaration

Props are declared via the `interface Props` + `$props()` pattern:

```svelte
<script lang="ts">
  interface Props {
    card: Card
    finishVariants?: Card[]
  }

  let { card, finishVariants = [card] }: Props = $props()
</script>
```

- Optional props always have defaults in the destructure
- The `Props` interface is declared inline in the `<script>` block

### Reactive State

```svelte
let quantity = $state(1)
let selectedCard = $state<Card>({} as Card)
let isLoading = $state(false)
```

- Typed with generic syntax `$state<Type>(initial)` when type cannot be inferred
- `$derived` is used for computed values:

```svelte
const price = $derived(getCardPrice(getMispriceKey(selectedCard)))
const cardIdentifier = $derived.by(() => {
  // multi-step computation
  const parts: string[] = []
  // ...
  return parts.join(' ')
})
```

### Side Effects

`$effect` replaces `onMount` for reactive side effects that depend on state:

```svelte
$effect(() => {
  const inStock = finishVariants.find((v) => v.is_in_stock)
  selectedCard = inStock || finishVariants[0] || card
})
```

> **Known issue**: `svelte-check` reports 11 warnings about `state_referenced_locally` — specifically where reactive state is captured in `$state(initialValue)` instead of `$derived`. These are acknowledged but unresolved as of the last check run.

### Event Handlers

Events use the Svelte 5 `on*` directive syntax (not `on:click`):

```svelte
<Button onclick={decrementQuantity} />
<button onclick={(e) => { e.preventDefault(); selectedCard = variant }}>
```

Event handlers that need to prevent default call `e.preventDefault()` and `e.stopPropagation()` explicitly.

### Children Rendering

Layouts use `{@render children()}` (Svelte 5 snippets API):

```svelte
let { data, children } = $props()
// ...
<main class="flex-1">
  {@render children()}
</main>
```

### UI Library: shadcn-svelte

Compound UI components are imported as namespaces to access sub-components:

```svelte
import * as CardUI from '$components/ui/card'
import * as Tooltip from '$components/ui/tooltip'

<CardUI.Root>
  <CardUI.Content>...</CardUI.Content>
</CardUI.Root>
```

Leaf components are imported directly:

```svelte
import { Button } from '$components/ui/button'
import { Badge } from '$components/ui/badge'
```

---

## Naming Conventions

### Files

| Type | Convention | Example |
|---|---|---|
| Svelte components | `PascalCase.svelte` | `CardItem.svelte`, `SearchFilters.svelte` |
| Svelte 5 stores | `camelCase.svelte.ts` | `cart.svelte.ts` |
| TypeScript modules | `kebab-case.ts` | `cart-service.ts`, `search-utils.ts` |
| Type files | `kebab-case.ts` | `cart-types.ts`, `database.types.ts` |
| Test files | `kebab-case.test.ts` | `utils.test.ts`, `cart-types.test.ts` |
| SvelteKit routes | SvelteKit conventions | `+page.svelte`, `+page.server.ts` |

### Variables and Functions

- `camelCase` for variables, functions, and method names
- `PascalCase` for types, interfaces, and class names
- `SCREAMING_SNAKE_CASE` for module-level constants: `LOCAL_CART_KEY`, `CACHE_TTL_MS`, `FOIL_SUBTYPES`
- Boolean variables prefixed with `is`/`has`/`any`: `isLoading`, `isSyncing`, `anyInStock`, `hasMore`

### Icons

Icons are sourced from `lucide-svelte` and imported as `PascalCase` named imports:

```typescript
import { Plus, Minus, ShoppingCart } from 'lucide-svelte'
```

---

## File Organization

```
src/
  app.css                   # Global CSS (Tailwind base + CSS variables)
  app.d.ts                  # SvelteKit global type augmentation
  app.html                  # HTML shell
  hooks.server.ts           # SvelteKit server hook (Supabase session setup)
  lib/
    __tests__/              # Unit tests for src/lib/
    admin-shared.ts         # Order status config (client + server)
    deck-utils.ts           # Deck parsing utilities
    supabase.ts             # Browser Supabase client factory
    utils.ts                # Pure utility functions (formatting, URLs, sorting)
    utils/                  # Utility sub-modules (request-queue, etc.)
    components/
      admin/                # Admin-specific UI components
      cards/                # Card display (CardGrid, CardItem, SearchFilters)
      cart/                 # Cart UI components
      icons/                # Custom icon components
      layout/               # Header, Footer, GroupBuyBanner
      ui/                   # shadcn-svelte primitives (27 component families)
    hooks/                  # Svelte hooks (is-mobile)
    server/
      __tests__/            # Unit tests for server lib
      admin.ts              # Admin Supabase client factory
      cart-service.ts       # CartService class (server-side cart ops)
      cart-types.ts         # Cart type definitions + hash/freshness utilities
      database.types.ts     # Generated Supabase types (DO NOT EDIT)
      export-builder.ts     # Excel/CSV export logic
      logger.ts             # Structured server logger
      notifications/        # Email notification system
      pricing.ts            # Price fetching with fallbacks
      search-utils.ts       # Card search/sort utilities
      types.ts              # Domain type aliases over database.types
      user-profile.ts       # User row management
    stores/
      cart.svelte.ts        # Client cart reactive store
  params/                   # SvelteKit param matchers
  routes/
    +layout.server.ts / +layout.svelte
    +page.server.ts / +page.svelte  # Main card catalog
    account/, admin/, api/, auth/, card/, cart/, checkout/, import/, orders/, profile/
```

---

## Import Patterns

### Path Aliases

Two aliases are configured in `svelte.config.js`:

| Alias | Maps to |
|---|---|
| `$lib` | `src/lib/` (SvelteKit default) |
| `$components` | `src/lib/components/` |

```typescript
// $lib alias
import { cartStore } from '$lib/stores/cart.svelte'
import { formatPrice } from '$lib/utils'
import type { Card } from '$lib/server/types'

// $components alias
import { Button } from '$components/ui/button'
import Header from '$components/layout/Header.svelte'

// SvelteKit built-ins
import { browser } from '$app/environment'
import { invalidateAll } from '$app/navigation'
import type { PageServerLoad } from './$types'

// Environment variables
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'
```

### Import Order (observed, not tool-enforced)

1. External package types and utilities
2. SvelteKit built-ins (`$app/*`, `@sveltejs/kit`)
3. UI component imports (`$components/ui/...`)
4. Internal `$lib/` imports
5. Icon imports (`lucide-svelte`)
6. Store imports

No import sorter plugin is installed; order is informal convention.

---

## State Management Conventions

### Client-Side: Factory Function Pattern

The cart store (`src/lib/stores/cart.svelte.ts`) is the canonical example:

```typescript
function createCartStore() {
  let items = $state<CartItem[]>([])
  let isLoading = $state(false)
  let lastError = $state<string | null>(null)

  // Private helpers close over state
  function applyServerItems(serverItems: CartItem[]): void { ... }
  function persistLocal() { ... }

  // Public API as returned object with getter accessors
  return {
    get items() { return items },
    get isLoading() { return isLoading },
    addItem, removeItem, syncFromServer, ...
  }
}

export const cartStore = createCartStore()
```

Key conventions:
- State is encapsulated — never exported as raw `$state` variables
- Getter accessors expose state reactively
- `localStorage` provides optimistic UI before server sync
- Optimistic removal tracking via `Set<string>` prevents race conditions

### Server-Side: Module-Level Cache with TTL

```typescript
interface CacheEntry<T> { data: T; timestamp: number }
let cardsCache: CacheEntry<Card[]> | null = null
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

function isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL_MS
}
```

No external caching library — all caching is in-memory, module-scoped, TTL-based.

### No Legacy Svelte Stores

The codebase does **not** use Svelte 4 `writable()`/`readable()` stores anywhere.

---

## Error Handling Patterns

### Supabase Query Errors

```typescript
const { data: batch, error } = await adminClient.from('cards').select(...)

if (error) {
  logger.error({ error }, 'Error fetching cards')
  break
}
```

### Structured Server Logging

```typescript
import { logger } from '$lib/server/logger'

logger.error({ error }, 'Error fetching cards')
logger.warn({ status: res.status }, 'API returned non-OK status')
```

### HTTP Errors in API Routes

```typescript
import { error } from '@sveltejs/kit'
throw error(500, 'Internal server error')
```

Zod validates request bodies in API routes — validation errors return `{ error: string, issues: ZodIssue[] }` JSON without throwing.

### Client-Side Error States

Components track errors as local `$state` rather than propagating exceptions:

```typescript
let lastError = $state<string | null>(null)
// ...
lastError = 'Failed to sync cart'
```

### Image Fallback Pattern

```svelte
<img onerror={() => handleImageError()} src={currentImageUrl} />
```

`handleImageError()` toggles a boolean flag; a `$derived` recomputes the URL to fall back from Ron's image to Scryfall.

---

## Code Style Rules

### Formatter: Prettier 3.x

Plugins active:
- `prettier-plugin-svelte` — formats `.svelte` files
- `prettier-plugin-tailwindcss` — sorts Tailwind class order

No explicit `.prettierrc` config file found — using Prettier defaults. Inferred settings from code: single quotes, no semicolons in some files (mixed — Prettier enforces). 

**Commands:** `npm run format` (write), `npm run lint` (check + ESLint).

### Linter: ESLint 9 Flat Config

Dependencies: `eslint`, `typescript-eslint`, `eslint-plugin-svelte`, `eslint-config-prettier`.

### Observed TypeScript Style

- `const` preferred over `let` for non-reassigned values
- Arrow functions for callbacks; `function` keyword for named exports
- JSDoc `/** ... */` on exported utility functions; `//` inline for implementation notes
- `as const` used for readonly tuple arrays: `['Foil', 'Galaxy Foil', ...] as const`

### Tailwind CSS Style

- Classes are inline strings on elements
- `cn()` utility from `$lib/utils` (wraps `clsx` + `tailwind-merge`) for conditional class merging
- Dynamic classes via template literals in Svelte class attributes

### Svelte File Style

- `<script lang="ts">` — always TypeScript
- HTML comments (`<!-- section name -->`) used to label template regions
- `{@const}` used for derived values within `{#each}` blocks
- Consistent use of `role="group"` and ARIA attributes on interactive regions
