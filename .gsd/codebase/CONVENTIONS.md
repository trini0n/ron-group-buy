# Coding Conventions

**Analysis Date:** 2026-03-14

## Naming Patterns

**Files:**
- TypeScript source: `kebab-case.ts` (e.g., `cart-service.ts`, `cart-types.ts`, `search-utils.ts`, `deck-utils.ts`, `admin-shared.ts`, `card-identity.ts`, `export-builder.ts`, `logger.ts`)
- Svelte components: `PascalCase.svelte` (e.g., `CardItem.svelte`, `CardGrid.svelte`, `CartMergeModal.svelte`, `SearchFilters.svelte`)
- Svelte rune stores: `<name>.svelte.ts` (e.g., `cart.svelte.ts`)
- SvelteKit routes: `+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+server.ts`
- Test files: `<module>.test.ts` inside co-located `__tests__/` subdirectories

**Functions:**
- `camelCase` for all functions: `formatPrice`, `getCardPrice`, `generateCartHash`, `isCartFresh`, `sortMatches`, `buildSupabaseMock`, `createMockCard`
- `PascalCase` for classes: `CartService`
- Consistent verb prefixes: `get*`, `is*`, `format*`, `create*`, `build*`, `fetch*`, `extract*`, `generate*`, `find*`

**Variables:**
- `camelCase` for local and module-level variables: `cardsCache`, `selectedCard`, `ronImageFailed`, `currentImageUrl`
- `UPPER_SNAKE_CASE` for module-level constants: `FALLBACK_PRICES`, `ADMIN_DISCORD_IDS`, `CART_FRESHNESS_THRESHOLD_MS`, `TYPE_ORDER`, `ORDER_STATUS_CONFIG`

**Types/Interfaces:**
- `PascalCase` with `interface` keyword for shaped objects: `CartItem`, `CardFilters`, `MockSupabaseResponse`, `CardMatch`, `CartValidation`, `LogContext`
- `PascalCase` with `type` keyword for aliases and unions: `Card`, `OrderStatus`, `LogLevel`
- DB row type aliases centralised in `src/lib/server/types.ts`: `type Card = Database['public']['Tables']['cards']['Row']`
- Append `Insert` for insert variants: `CardInsert`, and relational types use intersection: `CartItemWithCard = CartItem & { card: Card }`

**Svelte Components:**
- `PascalCase.svelte`, matching the exported component name
- Props type declared as local `interface Props {}` immediately before `$props()` destructure

## Code Style

**Formatting:**
- Tool: Prettier `^3.4.2` with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`
- Run: `npm run format` (`prettier --write .`)
- Check: included in `npm run lint` (`prettier --check . && eslint .`)
- No standalone config file found at project root; plugins declared as devDependencies

**Linting:**
- Tool: ESLint `^9.16.0` (flat config) with `typescript-eslint ^8.18.0`, `eslint-plugin-svelte ^2.46.0`, `eslint-config-prettier ^9.1.0`
- Run: `eslint .` (part of `npm run lint`)
- No standalone `eslint.config.js` found at project root

**TypeScript:**
- Strict mode: Yes
- `noUncheckedIndexedAccess: true` — array/index access always returns `T | undefined`
- `noImplicitOverride: true` — class overrides must use `override` keyword
- `noFallthroughCasesInSwitch: true`
- `allowJs: true`, `checkJs: true` — JavaScript files are also type-checked
- `moduleResolution: "bundler"` (Vite-compatible)
- `skipLibCheck: true`

## Import Organization

**Order (observed pattern):**
1. SvelteKit built-ins: `$app/environment`, `$app/navigation`, `$env/static/public`, `$env/static/private`
2. External libraries: `@supabase/supabase-js`, `lucide-svelte`, `mode-watcher`
3. Internal `$lib` aliases: `$lib/server/types`, `$lib/utils`, `$lib/stores/cart.svelte`
4. Internal `$components` alias: `$components/ui/button`, `$components/layout/Header.svelte`

**Path Aliases:**
- `$lib` → `src/lib` (SvelteKit built-in)
- `$components` → `src/lib/components` (defined in `svelte.config.js`)
- `$app/*`, `$env/*` — SvelteKit virtual modules

## Svelte Conventions

**Component structure:**
- `<script lang="ts">` block first
- Template (HTML) second
- `<style>` block last (if present)

**Props:**
- Defined with a local `interface Props {}` block, then destructured via `$props()`:
  ```typescript
  interface Props {
    card: Card;
    finishVariants?: Card[];
  }
  let { card, finishVariants = [card] }: Props = $props();
  ```

**Reactive state (Svelte 5 Runes):**
- `$state(value)` for mutable local variables: `let quantity = $state(1)`
- `$derived(expr)` for computed values: `const price = $derived(getCardPrice(selectedCard.card_type))`
- `$derived.by(() => {...})` for multi-step derivations
- `$effect(() => {...})` for side effects that depend on reactive state

**Stores:**
- Rune-based stores in `src/lib/stores/` with `.svelte.ts` extension
- Imported as `import { cartStore } from '$lib/stores/cart.svelte'`
- Store exposes plain methods (`cartStore.addItem(...)`, `cartStore.syncFromServer()`)

**Events:**
- Standard DOM event handlers passed as function references: `onclick={addToCart}`

## Error Handling

**Patterns:**
- Server routes: use SvelteKit `error(status, message)` which throws (not returns); callers use `rejects.toThrow` in tests
- API endpoints: `error(400, 'message')` for client errors, `error(404, ...)` for not found
- Logging then re-throw / early return pattern in server loaders using `logger.error(ctx, msg)` followed by `break` or `return`
- Client components: failures surfaced via toast notifications (svelte-sonner `Toaster`)

## Logging

**Patterns:**
- Custom `logger` from `$lib/server/logger.ts` — server-side only
- Structured JSON output: `{ timestamp, level, message, ...context }`
- Call signature: `logger.error({ contextObj }, 'stable message string')` — context object first, stable low-cardinality message string second
- Debug logs suppressed in production: `if (import.meta.env.DEV)` guard inside `logger.debug`
- Levels: `debug`, `info`, `warn`, `error`

## Function Design

**Size:** Small, single-purpose functions. Complex operations broken into private helpers (e.g., `CartService` private `getPrice()` method).

**Parameters:** Prefer plain objects for multiple related params; optional params use `?` default arguments.

**Return Values:** Named exports return typed values; async functions return `Promise<T>` (no implicit `any`). Nullable returns use `T | null` not `undefined`.

## Module Design

**Exports:** Named exports for all utilities and types (no default exports in `.ts` files). Svelte components use implicit default export.

**Server-only code:** Placed in `src/lib/server/` directory. SvelteKit enforces that `$lib/server/*` cannot be imported from client-side code. Route server files use `+page.server.ts` / `+server.ts` suffix.

**Section dividers:** Long files use ASCII divider comments for visual grouping:
```typescript
// ─── Section Name ─────────────────────────────────────────────
```

---
_Convention analysis: 2026-03-14_
- Logging then re-throw / early return pattern in server loaders using `logger.error(ctx, msg)` followed by `break` or `return`
- Client components: failures surfaced via toast notifications (svelte-sonner `Toaster`)

## Logging

**Patterns:**
- Custom `logger` from `$lib/server/logger.ts` -- server-side only
- Structured JSON output: `{ timestamp, level, message, ...context }`
- Call signature: `logger.error({ contextObj }, 'stable message string')` -- context object first, stable low-cardinality message string second
- Debug logs suppressed in production: `if (import.meta.env.DEV)` guard inside `logger.debug`
- Levels: `debug`, `info`, `warn`, `error`

## Function Design

**Size:** Small, single-purpose functions. Complex operations broken into private helpers (e.g., `CartService` private `getPrice()` method).

**Parameters:** Prefer plain objects for multiple related params; optional params use `?` default arguments.

**Return Values:** Named exports return typed values; async functions return `Promise<T>` (no implicit `any`). Nullable returns use `T | null` not `undefined`.

## Module Design

**Exports:** Named exports for all utilities and types (no default exports in `.ts` files). Svelte components use implicit default export.

**Server-only code:** Placed in `src/lib/server/` directory. SvelteKit enforces that `$lib/server/*` cannot be imported from client-side code. Route server files use `+page.server.ts` / `+server.ts` suffix.

**Section dividers:** Long files use ASCII divider comments for visual grouping:
```
// --- Section Name ----------------------------------------------------
```

---
_Convention analysis: 2026-03-14_
