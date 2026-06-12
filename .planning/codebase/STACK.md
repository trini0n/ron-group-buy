---
updated: 2026-06-11
focus: tech
---

# Tech Stack

## Overview

Ron's Group Buy is a full-stack SvelteKit application for managing Magic: The Gathering proxy group buys. It uses Svelte 5, TypeScript, Tailwind CSS, and Supabase for its backend. The app is deployed on Vercel with a Node.js 22 runtime.

---

## Runtime & Framework

| Layer | Technology | Version |
|---|---|---|
| Framework | SvelteKit | `^2.9.0` |
| UI Engine | Svelte | `^5.12.0` (Runes API) |
| Adapter | `@sveltejs/adapter-vercel` | `^5.4.0` |
| Node.js Runtime | Vercel Node.js | `nodejs22.x` (set in `svelte.config.js`) |
| Language | TypeScript | `^5.7.2` |
| Module Type | ESM (`"type": "module"`) | — |

Svelte 5 Runes (`$state`, `$derived`, `$props`) are used extensively throughout — this is not a legacy Svelte 4 project.

---

## Languages

- **TypeScript** — all source files, including `.svelte` script blocks (`lang="ts"`)
- **SQL** — 24 migration files in `supabase/migrations/`
- **HTML/CSS** — within `.svelte` templates

TypeScript is configured with strict mode, `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noFallthroughCasesInSwitch`.

---

## Build Tools

| Tool | Version | Role |
|---|---|---|
| Vite | `^6.0.3` | Dev server and bundler |
| `@sveltejs/vite-plugin-svelte` | `^5.0.0` | Svelte integration for Vite |
| `vitePreprocess` | (bundled) | Preprocesses Svelte files for TypeScript/PostCSS |
| `tsx` | `^4.19.2` | Runs TypeScript scripts directly (e.g., `scripts/sync-cards.ts`) |

**`vite.config.ts`** is minimal — only the SvelteKit plugin, no custom config.

---

## CSS & Styling

| Tool | Version | Role |
|---|---|---|
| Tailwind CSS | `^3.4.16` | Utility-first CSS |
| PostCSS | `^8.4.49` | CSS pipeline |
| Autoprefixer | `^10.4.20` | Vendor prefix injection |
| `tailwind-merge` | `^2.6.0` | Merges conflicting Tailwind classes |
| `tailwind-variants` | `^0.2.1` | Variant-based class composition |
| `clsx` | `^2.1.1` | Conditional class construction |
| `mode-watcher` | `^1.1.0` | Dark/light mode management |

**Tailwind Config highlights:**
- Dark mode via `class` strategy
- Custom MTG color palette: `mtg.white`, `mtg.blue`, `mtg.black`, `mtg.red`, `mtg.green`, `mtg.colorless`, `mtg.gold`
- CSS variable-based semantic colors (`--border`, `--primary`, etc.) following shadcn-svelte convention
- `Inter` font family
- 2xl container capped at `1400px`
- `zinc` base color (from `components.json`)

---

## Component Library

**shadcn-svelte** (configured via `components.json`):
- Registry: `https://tw3.shadcn-svelte.com/registry/default`
- All UI components live in `src/lib/components/ui/`
- Components present: `accordion`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `button`, `card`, `checkbox`, `command`, `dialog`, `dropdown-menu`, `input`, `label`, `pagination`, `popover`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `switch`, `table`, `textarea`, `tooltip`

**bits-ui** (`^1.8.0`) — headless UI primitives underlying shadcn-svelte components.

**Icon libraries:**
- `lucide-svelte` (`^0.468.0`) — main icon set used throughout
- `@lucide/svelte` (`^0.482.0`) — additional Lucide icons (dev dependency)

**Toast notifications:** `svelte-sonner` (`^0.3.28`) — Sonner toast library ported to Svelte; `Toaster` component mounted in root layout.

---

## Testing

| Tool | Version | Role |
|---|---|---|
| Vitest | `^3.0.0` | Test runner |
| `@testing-library/svelte` | `^5.2.0` | Component testing utilities |
| `jsdom` | `^26.0.0` | Browser DOM simulation |
| `@vitest/coverage-v8` | `^3.0.0` | V8-based code coverage |

**Test configuration (`vitest.config.ts`):**
- Environment: `jsdom`
- Globals enabled
- Setup file: `./tests/setup.ts`
- Test pattern: `src/**/*.{test,spec}.{js,ts}`
- Coverage thresholds: 80% statements/branches/lines, 90% functions
- Coverage scope limited to: `utils.ts`, `admin-shared.ts`, `deck-utils.ts`, `cart-types.ts`, `search-utils.ts`

**CI (`ci.yml`):**
- GitHub Actions on push/PR to `main`
- Node.js 20 in CI (despite Node 22 at runtime)
- Steps: `npm ci` → `svelte-kit sync` → lint (non-blocking) → `test:ci` (with coverage)
- Coverage artifacts retained 14 days on GitHub

---

## Deployment

- **Platform:** Vercel
- **Adapter:** `@sveltejs/adapter-vercel` targeting `nodejs22.x`
- **Cron Job:** Vercel Cron — `GET /api/admin/exports/cleanup` runs hourly (`0 * * * *`), defined in `.vercel/cron.json`
- **Environment:** Production env vars managed via Vercel dashboard

---

## Key Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | `^2.47.10` | Supabase JS client |
| `@supabase/ssr` | `^0.5.2` | SSR-safe Supabase with cookie-based sessions |
| `zod` | `^3.24.1` | Schema validation on all API endpoints |
| `exceljs` | `^4.4.0` | Excel (.xlsx) generation for order exports |
| `csv-parse` | `^6.1.0` | CSV parsing for admin inventory sync uploads |
| `lru-cache` | `^11.0.2` | In-memory LRU caching (card search, Scryfall set dates) |
| `country-telephone-data` | `^0.6.3` | Country dialing codes for phone number input |
| `clsx` | `^2.1.1` | Class name utilities |

---

## Dev Toolchain

| Tool | Version | Role |
|---|---|---|
| ESLint | `^9.16.0` | JavaScript/TypeScript linting |
| `eslint-plugin-svelte` | `^2.46.0` | Svelte-aware lint rules |
| `typescript-eslint` | `^8.18.0` | TypeScript lint rules |
| `eslint-config-prettier` | `^9.1.0` | Disables ESLint formatting rules (defers to Prettier) |
| Prettier | `^3.4.2` | Code formatting |
| `prettier-plugin-svelte` | `^3.3.2` | Svelte file formatting |
| `prettier-plugin-tailwindcss` | `^0.6.9` | Automatic Tailwind class ordering |
| `svelte-check` | `^4.1.0` | TypeScript type-checking for `.svelte` files |
| `dotenv` | `^17.2.3` | Loads `.env` in standalone scripts |
| Supabase CLI | `^2.70.5` | Local Supabase dev, migrations, type generation |

**NPM scripts:**

```
dev            vite dev
build          vite build
preview        vite preview
check          svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
lint           prettier --check . && eslint .
format         prettier --write .
test           vitest
test:unit      vitest run
test:ci        vitest run --coverage
coverage       vitest run --coverage
db:generate    supabase gen types typescript --local > src/lib/server/database.types.ts
db:push        supabase db push
db:reset       supabase db reset
sync:cards     tsx scripts/sync-cards.ts
```

---

## Path Aliases

| Alias | Resolves To |
|---|---|
| `$lib` | `src/lib` (SvelteKit default) |
| `$components` | `src/lib/components` |
| `$components/*` | `src/lib/components/*` |
| `$env/static/public` | SvelteKit public env vars |
| `$env/static/private` | SvelteKit private env vars |
| `$env/dynamic/private` | SvelteKit dynamic private env vars |

---

## Database

- **Engine:** PostgreSQL (hosted by Supabase)
- **Migrations:** 24 SQL files in `supabase/migrations/` (Jan–May 2026)
- **Type generation:** `src/lib/server/database.types.ts` generated locally via `npm run db:generate` (gitignored, re-generated per schema change)
- **RLS:** Row-Level Security enabled and actively tuned across multiple migrations
- **Atomic DB functions:** Stored procedures for critical cart/order operations (`atomic_order_functions` migration)
