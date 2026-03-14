# CONVENTIONS.md — Code Conventions

## TypeScript

- **Strict mode** enabled: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`
- **JS files checked**: `"allowJs": true`, `"checkJs": true`
- **Module resolution**: `bundler`
- **SvelteKit types** used consistently:
  - `PageServerLoad`, `LayoutServerLoad` in server loaders
  - `RequestHandler` in API endpoints

### Interfaces vs Types

- Use `interface` for structured object contracts:
  ```typescript
  interface CardFilters {
    set: string
    foil: boolean
    priceMin?: number
  }
  interface PaginatedResult<T> {
    data: T[]
    total: number
    page: number
  }
  ```
- Use `type` for aliases, unions, and derivations:
  ```typescript
  type Card = Database['public']['Tables']['cards']['Row']
  type OrderStatus = keyof typeof ORDER_STATUS_CONFIG
  ```

## Naming

| Thing                 | Convention                   | Example                                     |
| --------------------- | ---------------------------- | ------------------------------------------- |
| Variables / functions | `camelCase`                  | `fetchPrices`, `cartItems`                  |
| Constants             | `UPPER_SNAKE_CASE`           | `CACHE_TTL_MS`, `ADMIN_DISCORD_IDS`         |
| Types / Interfaces    | `PascalCase`                 | `CartItem`, `PaginatedResult`               |
| Route directories     | `kebab-case`                 | `order-items/`, `bulk-status/`              |
| Feature components    | `PascalCase`                 | `CardGrid.svelte`, `GroupBuyBanner.svelte`  |
| UI primitives         | `kebab-case` file            | `button.svelte`, `sidebar-menu-item.svelte` |
| Svelte 5 stores       | `{name}.svelte.ts`           | `cart.svelte.ts`                            |
| Store instance        | `camelCase` + `Store` suffix | `cartStore`                                 |

## Component Structure (`.svelte` files)

Order in `.svelte` files:

1. `<script lang="ts">` — component logic
2. Template markup — HTML with Svelte expressions
3. `<style>` — not used; all styling via Tailwind classes

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let loading = $state(false);
</script>

<div class="flex flex-col gap-4">
  {#if loading}
    <Spinner />
  {:else}
    <CardGrid cards={data.cards} />
  {/if}
</div>
```

## State Management (Svelte 5 Runes)

This codebase uses **Svelte 5 runes**, not traditional stores:

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);
  $effect(() => { console.log('count changed', count); });
</script>
```

- `$state(...)` — reactive local state
- `$derived(...)` — computed values
- `$effect(...)` — side effects
- `$props()` — component props
- `$bindable()` — two-way bindable props

Centralized client state for cart:

```typescript
// src/lib/stores/cart.svelte.ts
export function createCartStore() { ... }
export const cartStore = createCartStore();
```

Traditional `writable`/`readable` not used for app state. Use runes.

## Error Handling

### Server (API endpoints)

```typescript
import { error, json } from '@sveltejs/kit'

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json()
    if (!body.itemId) throw error(400, 'itemId required')

    const result = await doWork(body)
    return json(result)
  } catch (err) {
    // Re-throw SvelteKit errors (they have .status)
    if (err && typeof err === 'object' && 'status' in err) throw err
    console.error('Unexpected error:', err)
    throw error(500, 'Internal server error')
  }
}
```

### Server (page loaders — auth gates)

```typescript
export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(303, `/auth/login?next=${url.pathname}`)
  }
  // ...
}
```

### Client (components)

```svelte
<script lang="ts">
  let errorMsg = $state('');
  async function handleSubmit() {
    try {
      const res = await fetch('/api/orders', { method: 'POST', body: ... });
      if (!res.ok) { errorMsg = await res.text(); return; }
    } catch (e) {
      errorMsg = 'Network error';
    }
  }
</script>
```

## Import Patterns

Always use aliases — no relative `../../` imports:

```typescript
// Correct
import { cartStore } from '$lib/stores/cart.svelte'
import { isAdmin } from '$lib/server/admin'
import { Button } from '$components/ui/button'
import { env } from '$env/static/private'

// Avoid
import { cartStore } from '../../stores/cart.svelte'
```

Note: Minor inconsistency exists — some files use `$components/...` and others use `$lib/components/...`. Prefer `$components` to match the registered alias.

## Async Patterns

### Server loaders

```typescript
export const load: PageServerLoad = async ({ locals, parent }) => {
  const parentData = await parent() // Access layout data
  const { data } = await locals.supabase.from('cards').select('*').limit(20)
  return { cards: data, session: parentData.session }
}
```

### Streaming (home page pattern)

```typescript
return {
  streamed: {
    cardsData: Promise.all([fetchCards(), fetchSets()])
  }
}
```

### API endpoints

```typescript
export const GET: RequestHandler = async ({ locals, url }) => { ... };
export const POST: RequestHandler = async ({ request, locals }) => { ... };
export const PATCH: RequestHandler = async ({ request, params, locals }) => { ... };
export const DELETE: RequestHandler = async ({ params, locals }) => { ... };
```

## Validation

Use **Zod** for request body validation at API boundaries:

```typescript
import { z } from 'zod'
const schema = z.object({ itemId: z.string().uuid(), quantity: z.number().int().positive() })
const parsed = schema.safeParse(await request.json())
if (!parsed.success) throw error(400, parsed.error.message)
```

## Code Formatting

- Prettier enforced for all files (`npm run lint` / `npm run format`)
- Plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss`
- Config: no standalone `.prettierrc` found — uses defaults + plugins
- ESLint: `typescript-eslint`, `eslint-plugin-svelte`, `eslint-config-prettier`

## Styling

- **All styling via Tailwind utility classes** — no local `<style>` blocks
- Dark mode via `class` strategy (`dark:` prefix)
- `tailwind-merge` for conditional class merging, `tailwind-variants` for component variants
- `clsx` for conditional class names
- MTG color identity palette defined in `tailwind.config.js`
