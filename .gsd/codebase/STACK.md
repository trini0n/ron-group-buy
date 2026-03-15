# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**

- TypeScript 5.7.2 - All application logic, SvelteKit routes, server-side handlers, scripts; strict mode + `noUncheckedIndexedAccess`

**Secondary:**

- JavaScript ESM - Config files (`svelte.config.js`, `tailwind.config.js`, `postcss.config.js`, `vitest.config.ts`), utility scripts (`scripts/fix-bookmarklet.mjs`, `scripts/test-moxfield.mjs`)
- Svelte 5 `.svelte` files - UI components (Svelte 5 runes syntax)
- SQL - Database migrations in `supabase/migrations/`

## Runtime

**Environment:**

- Node.js 22.x - Production target; explicit `runtime: 'nodejs22.x'` in `svelte.config.js`

**Package Manager:**

- npm - `package.json` with `"type": "module"`
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**

- SvelteKit ^2.9.0 - Full-stack web framework (routing, SSR, server actions)
- Svelte ^5.12.0 - Component framework; Svelte 5 runes syntax throughout

**Testing:**

- Vitest ^3.0.0 - Test runner; jsdom environment, globals enabled
- @testing-library/svelte ^5.2.0 - Component testing utilities
- @vitest/coverage-v8 ^3.0.0 - Code coverage provider (80%/90% thresholds)

**Build/Dev:**

- Vite ^6.0.3 - Build tool; configured via `vite.config.ts` (sveltekit plugin only)
- @sveltejs/adapter-vercel ^5.4.0 - Vercel deployment adapter
- tsx ^4.19.2 - Execute TypeScript scripts directly (used for `sync:cards`)

## Key Dependencies

**Critical:**

- @supabase/supabase-js ^2.47.10 - Database client + auth (primary data layer)
- @supabase/ssr ^0.5.2 - SSR-safe Supabase session handling; cookies managed in `src/hooks.server.ts`
- zod ^3.24.1 - Runtime schema validation for API inputs and form data

**Infrastructure:**

- lru-cache ^11.0.2 - In-process LRU cache for card search deduplication (`src/routes/api/import/search/+server.ts`)
- exceljs ^4.4.0 - Server-side Excel (.xlsx) export generation (`src/lib/server/export-builder.ts`)
- csv-parse ^6.1.0 - CSV parsing for Google Sheets inventory sync (`src/routes/api/admin/inventory/sync/+server.ts`)
- clsx ^2.1.1 - Conditional class name construction
- tailwind-merge ^2.6.0 - Tailwind class deduplication
- tailwind-variants ^0.2.1 - Variant-based component styling
- bits-ui ^1.8.0 - Headless UI primitives (shadcn-svelte foundation; `components.json` present)
- svelte-sonner ^0.3.28 - Toast notification UI
- @lucide/svelte ^0.482.0 + lucide-svelte ^0.468.0 - Icon sets
- mode-watcher ^1.1.0 - Dark/light mode management
- country-telephone-data ^0.6.3 - Phone number prefix data for checkout forms
- dotenv ^17.2.3 - `.env` loading in Node scripts (`sync:cards`)

## Configuration

**Environment:**

- SvelteKit `$env/static/public` and `$env/static/private` for type-safe env access
- Required vars: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, `PUBLIC_APP_URL`, `CRON_SECRET`
- `import.meta.env.DEV` used in `src/lib/server/logger.ts`

**Build:**

- `svelte.config.js` - adapter-vercel, nodejs22.x, `$components` path alias → `src/lib/components`
- `tsconfig.json` - strict mode, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `allowJs`/`checkJs`
- `vite.config.ts` - minimal; sveltekit() plugin only
- `vitest.config.ts` - jsdom, globals, setup at `tests/setup.ts`, explicit coverage includes
- `tailwind.config.js` - dark mode via class strategy; custom MTG color palette; `content: src/**/*.{html,js,svelte,ts}`
- `postcss.config.js` - tailwindcss + autoprefixer

## Platform Requirements

**Development:**

- Node.js 22.x (matches production)
- Supabase CLI for `db:generate`, `db:push`, `db:reset`
- `.env` file with all required vars (see above)

**Production:**

- Vercel platform with Node.js 22.x serverless runtime
- Supabase project (PostgreSQL database + Auth + Row Level Security)
- Discord bot application (for DM notifications)

---

_Stack analysis: 2026-03-14_
