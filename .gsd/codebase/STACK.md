# STACK.md — Technology Stack

## Languages

- **TypeScript** `^5.7.2` — primary language, strict mode enabled
- **JavaScript ESM** — `"type": "module"` in package.json
- **Svelte** `.svelte` files with `<script lang="ts">` — component language
- **SQL** — Supabase/Postgres migrations in `supabase/migrations/`

## Runtime

- **Node.js 22** on Vercel (explicit: `runtime: 'nodejs22.x'` in `svelte.config.js`)
- **Node.js 20+** required locally (per README)
- `tsx ^4.19.2` for running TS scripts directly

## Frameworks

- **SvelteKit** `@sveltejs/kit ^2.9.0` — full-stack web framework
- **Svelte** `svelte ^5.12.0` — component framework (Svelte 5 runes)
- **Vite** `vite ^6.0.3` — build tool
- **@sveltejs/adapter-vercel** `^5.4.0` — deployment adapter

## Key Runtime Dependencies

| Package                 | Version    | Purpose                               |
| ----------------------- | ---------- | ------------------------------------- |
| `@supabase/supabase-js` | `^2.47.10` | Database + auth client                |
| `@supabase/ssr`         | `^0.5.2`   | Server-side Supabase session handling |
| `zod`                   | `^3.24.1`  | Schema validation                     |
| `lru-cache`             | `^11.0.2`  | In-process caching                    |
| `csv-parse`             | `^6.1.0`   | CSV parsing (inventory sync)          |
| `exceljs`               | `^4.4.0`   | Excel export generation               |
| `clsx`                  | `^2.1.1`   | Conditional class names               |

## Dev Dependencies

**Testing**

- `vitest ^3.0.0` — test runner
- `@vitest/coverage-v8 ^3.0.0` — coverage provider
- `@testing-library/svelte ^5.2.0` — component testing
- `jsdom ^26.0.0` — DOM environment

**Styling/UI**

- `tailwindcss ^3.4.16` + `postcss ^8.4.49` + `autoprefixer ^10.4.20`
- `bits-ui ^1.8.0` — headless UI primitives (shadcn-svelte base)
- `svelte-sonner ^0.3.28` — toast notifications
- `tailwind-merge ^2.6.0` + `tailwind-variants ^0.2.1`
- `@lucide/svelte ^0.482.0` + `lucide-svelte ^0.468.0` — icons
- `mode-watcher ^1.1.0` — dark mode

**Lint/Format**

- `eslint ^9.16.0` + `typescript-eslint ^8.18.0` + `eslint-plugin-svelte ^2.46.0`
- `prettier ^3.4.2` + `prettier-plugin-svelte` + `prettier-plugin-tailwindcss`

## Configuration Files

| File                 | Key Settings                                                                         |
| -------------------- | ------------------------------------------------------------------------------------ |
| `svelte.config.js`   | adapter-vercel, nodejs22.x runtime, `$components` alias → `src/lib/components`       |
| `tsconfig.json`      | strict, noUncheckedIndexedAccess, moduleResolution: bundler, allowJs, checkJs        |
| `vite.config.ts`     | sveltekit() plugin only                                                              |
| `vitest.config.ts`   | jsdom env, globals, setup: `tests/setup.ts`, coverage thresholds 80%/90%             |
| `tailwind.config.js` | dark mode class strategy, MTG color palette, content: `src/**/*.{html,js,svelte,ts}` |
| `components.json`    | shadcn-svelte schema, TS enabled, aliases to `$lib/...`                              |
| `postcss.config.js`  | tailwindcss + autoprefixer                                                           |

## Environment Variables (names only)

**Required**

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCORD_BOT_TOKEN`
- `PUBLIC_APP_URL`
- `CRON_SECRET`

**Built-in**

- `import.meta.env.DEV` (Vite)

**Referenced in `.env.example` but not yet consumed**

- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`
- `RESEND_API_KEY`

## npm Scripts

```
dev           → vite dev
build         → vite build
preview       → vite preview
check         → svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
lint          → prettier --check . && eslint .
format        → prettier --write .
test          → vitest (watch)
test:unit     → vitest run
test:ci       → vitest run --coverage
coverage      → vitest run --coverage
db:generate   → supabase gen types typescript ... > src/lib/server/database.types.ts
sync:cards    → tsx scripts/sync-cards.ts
```
