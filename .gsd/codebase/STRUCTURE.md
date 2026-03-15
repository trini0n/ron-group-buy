# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
group-buy/
├── src/                          # Application source code
│   ├── app.html                  # HTML shell (SvelteKit entry point)
│   ├── app.d.ts                  # Global TypeScript declarations (App.Locals, App.PageData)
│   ├── app.css                   # Global Tailwind base + CSS custom properties
│   ├── hooks.server.ts           # Per-request bootstrap: Supabase client + auth
│   │
│   ├── params/
│   │   └── lang.ts               # Route param matcher: 2-3 char ISO language codes
│   │
│   ├── lib/                      # Shared application code (aliased as $lib)
│   │   ├── supabase.ts           # Supabase client factories (browser + server)
│   │   ├── utils.ts              # Shared utility functions (formatting, sorting, URL helpers)
│   │   ├── deck-utils.ts         # Deck text parsing and card-type ordering
│   │   ├── admin-shared.ts       # Admin Discord IDs, order status config (client + server safe)
│   │   │
│   │   ├── auth/
│   │   │   ├── conflicts.ts      # OAuth provider conflict detection logic
│   │   │   └── errors.ts         # Auth error code enum, messages, HTTP status map
│   │   │
│   │   ├── components/           # Reusable UI components (aliased as $components)
│   │   │   ├── cards/            # Card catalog components
│   │   │   │   ├── CardGrid.svelte
│   │   │   │   ├── CardGridSkeleton.svelte
│   │   │   │   ├── CardItem.svelte
│   │   │   │   ├── CardTableView.svelte
│   │   │   │   └── SearchFilters.svelte
│   │   │   ├── cart/
│   │   │   │   └── CartMergeModal.svelte   # Guest→user cart merge confirmation dialog
│   │   │   ├── icons/
│   │   │   │   └── ManaIcon.svelte         # MTG mana symbol icon
│   │   │   ├── layout/
│   │   │   │   ├── Header.svelte
│   │   │   │   ├── Footer.svelte
│   │   │   │   └── GroupBuyBanner.svelte   # Group-buy open/close status banner
│   │   │   └── ui/                         # shadcn-svelte primitives
│   │   │       ├── accordion/, alert-dialog/, avatar/, badge/, breadcrumb/
│   │   │       ├── button/, card/, checkbox/, command/, dialog/
│   │   │       ├── dropdown-menu/, input/, label/, pagination/
│   │   │       ├── popover/, radio-group/, scroll-area/, select/
│   │   │       ├── separator/, sheet/, sidebar/, skeleton/, sonner/
│   │   │       ├── switch/, table/, textarea/, tooltip/
│   │   │       ├── CountrySelect.svelte    # Country + dial-code selector
│   │   │       └── PhoneInput.svelte       # Phone number input with country code
│   │   │
│   │   ├── data/
│   │   │   └── countries.ts               # ISO country list with dial codes
│   │   │
│   │   ├── hooks/
│   │   │   └── is-mobile.svelte.ts        # Svelte 5 reactive mobile breakpoint hook
│   │   │
│   │   ├── stores/
│   │   │   └── cart.svelte.ts             # Client cart store: server sync, localStorage, optimistic updates
│   │   │
│   │   ├── utils/
│   │   │   └── request-queue.ts           # Serializes concurrent async cart API calls
│   │   │
│   │   ├── server/                        # Server-only modules (never import in .svelte files)
│   │   │   ├── database.types.ts          # Generated Supabase schema types (do not edit by hand)
│   │   │   ├── types.ts                   # Domain type aliases (Card, Order, CartItem, etc.)
│   │   │   ├── cart-types.ts              # Cart/merge-specific types and helpers
│   │   │   ├── admin.ts                   # isAdmin(), createAdminClient(), admin guards
│   │   │   ├── pricing.ts                 # Fetch card-type prices from DB (with fallback)
│   │   │   ├── cart-service.ts            # CartService class: CRUD, validate, merge
│   │   │   ├── card-identity.ts           # Card identity key generation + duplicate detection
│   │   │   ├── search-utils.ts            # Card search helpers (cache key, foil detection, sort)
│   │   │   ├── set-release-dates.ts       # MTG set code → release date map
│   │   │   ├── gphoto-converter.ts        # Google Photos URL → direct URL converter (DB cached)
│   │   │   ├── export-builder.ts          # Excel (.xlsx) order export generator
│   │   │   ├── export-storage.ts          # Export file TTL storage + mutex-protected manifest
│   │   │   ├── logger.ts                  # Structured JSON logger (debug/info/warn/error)
│   │   │   ├── user-profile.ts            # ensureUserRow() — sync auth user to public.users
│   │   │   └── notifications/
│   │   │       ├── service.ts             # NotificationService: preference-aware dispatch
│   │   │       ├── discord.ts             # Discord DM transport (HTTP bot API)
│   │   │       ├── templates.ts           # Notification message template functions
│   │   │       ├── types.ts               # Notification type definitions
│   │   │       └── index.ts               # Barrel export
│   │   │
│   │   └── __tests__/                     # Unit tests for shared lib modules
│   │       ├── admin-shared.test.ts
│   │       └── utils.test.ts
│   │
│   └── routes/                            # SvelteKit file-based routing
│       ├── +layout.server.ts              # Root: session, prices, groupBuyConfig, isAdmin
│       ├── +layout.svelte                 # Root shell: Header, Footer, auth sync, cart merge modal
│       ├── +page.server.ts                # Home: card catalog data (with in-memory TTL cache)
│       ├── +page.svelte                   # Home: card catalog search UI
│       │
│       ├── account/                       # Account management page
│       │
│       ├── auth/
│       │   ├── callback/+server.ts        # OAuth callback: code exchange, user sync, conflict check
│       │   ├── login/                     # Login page
│       │   ├── logout/+server.ts          # Sign-out handler
│       │   ├── signup/                    # Sign-up page
│       │   ├── forgot-password/           # Password reset request page
│       │   └── reset-password/            # Password reset form (token-gated)
│       │
│       ├── card/
│       │   └── [setCode]/                 # Card detail page (dynamic route)
│       │
│       ├── cards/                         # Cards listing page
│       │
│       ├── cart/                          # Cart review page
│       │
│       ├── checkout/                      # Checkout (auth-required; validates group buy open)
│       │
│       ├── import/                        # Deck import UI (Moxfield/Archidekt/plain text)
│       │
│       ├── orders/
│       │   ├── +page.server.ts            # Order history list (auth-required)
│       │   ├── +page.svelte
│       │   └── [id]/                      # Order detail page
│       │
│       ├── profile/
│       │   ├── +page.server.ts            # Profile page (auth-required)
│       │   ├── +page.svelte
│       │   └── conflict/                  # OAuth identity conflict resolution page
│       │
│       ├── admin/
│       │   ├── +layout.server.ts          # Admin auth guard + dashboard stats
│       │   ├── +layout.svelte             # Admin shell UI (sidebar, nav)
│       │   ├── +page.svelte               # Admin dashboard
│       │   ├── inventory/                 # Inventory CRUD
│       │   ├── orders/
│       │   │   ├── +page.server.ts        # Order list with filters
│       │   │   ├── +page.svelte
│       │   │   └── [id]/                  # Order detail + status management
│       │   ├── settings/
│       │   │   ├── +page.server.ts        # General settings
│       │   │   ├── notifications/         # Notification template settings
│       │   │   └── pricing/               # Card-type pricing configuration
│       │   └── users/
│       │       ├── +page.server.ts        # User list
│       │       ├── +page.svelte
│       │       └── [id]/                  # User detail + admin actions
│       │
│       └── api/
│           ├── cart/
│           │   ├── +server.ts             # GET cart, POST add item
│           │   ├── [itemId]/+server.ts    # PATCH update qty, DELETE remove item
│           │   ├── bulk/+server.ts        # POST bulk add items
│           │   ├── merge/+server.ts       # POST merge guest cart into user cart
│           │   └── validate/+server.ts    # POST validate cart stock/prices
│           ├── orders/
│           │   ├── +server.ts             # POST create order from cart
│           │   └── [id]/+server.ts        # GET/PATCH order by id
│           ├── import/
│           │   ├── deck/+server.ts        # POST import parsed deck (Moxfield/Archidekt)
│           │   └── search/+server.ts      # POST search cards for deck import
│           ├── profile/
│           │   ├── +server.ts             # GET/PATCH profile
│           │   ├── addresses/+server.ts   # Address CRUD
│           │   ├── auth/+server.ts        # OAuth provider link/unlink
│           │   ├── notifications/+server.ts # Notification preference updates
│           │   └── password/+server.ts    # Password change
│           └── admin/
│               ├── config/+server.ts      # GET/PATCH group buy config
│               ├── config/[id]/+server.ts # PATCH specific config entry
│               ├── exports/               # Export generation + cleanup endpoints
│               ├── inventory/             # Inventory sync + bulk ops + image resync
│               ├── orders/                # Admin order status + bulk status updates
│               ├── pricing/+server.ts     # Card-type pricing CRUD
│               ├── sync-alerts/+server.ts # Inventory sync alert management
│               ├── templates/+server.ts   # Notification template CRUD
│               └── users/[id]/+server.ts  # Admin user management
│
├── static/
│   └── images/                            # Static image assets
│
├── supabase/
│   └── migrations/                        # SQL migration files (chronological)
│
├── scripts/                               # One-off maintenance and tooling scripts
│   ├── sync-cards.ts                      # Card inventory sync
│   ├── convert-gphoto-urls.ts             # Batch Google Photos URL conversion
│   ├── fix-bookmarklet.mjs                # Bookmarklet utility
│   └── test-moxfield.mjs                  # Moxfield API test script
│
├── tests/                                 # Global Vitest setup
│   ├── setup.ts                           # Test environment setup
│   └── mocks/                             # Shared mock factories
│
├── coverage/                              # Vitest coverage reports (gitignored)
├── docs/                                  # Developer documentation
├── .gsd/                                  # GSD planning artifacts (not shipped)
│
├── svelte.config.js                       # SvelteKit config: Vercel adapter, path aliases
├── vite.config.ts                         # Vite plugins and test config
├── vitest.config.ts                       # Vitest runner configuration
├── tailwind.config.js                     # Tailwind CSS theme + content paths
├── postcss.config.js                      # PostCSS (Tailwind + autoprefixer)
├── tsconfig.json                          # TypeScript (extends .svelte-kit/tsconfig.json)
├── components.json                        # shadcn-svelte CLI configuration
└── package.json
```

## Directory Purposes

**`src/`:**
- Purpose: All application source code
- Contains: Entry files, global styles, SvelteKit routes, shared lib modules
- Key files: `app.d.ts`, `hooks.server.ts`, `app.css`, `app.html`

**`src/routes/`:**
- Purpose: File-based routing — every folder is a URL segment; co-located server and client files
- Contains: `+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+layout.server.ts`, `+server.ts` (API endpoints)
- Key files: `+layout.server.ts` (root data), `+layout.svelte` (root shell), `admin/+layout.server.ts` (admin guard)

**`src/lib/`:**
- Purpose: Code shared across routes; anything imported with `$lib/`
- Contains: Supabase factories, utility functions, components, stores, server-only services
- Key files: `supabase.ts`, `admin-shared.ts`, `utils.ts`

**`src/lib/server/`:**
- Purpose: Server-only modules; never imported in `.svelte` files or client-side code
- Contains: Domain services, database types, admin utilities, logger
- Key files: `database.types.ts`, `types.ts`, `cart-service.ts`, `admin.ts`, `logger.ts`

**`src/lib/components/`:**
- Purpose: Reusable Svelte components; accessible via `$components` alias
- Contains: Feature components (cards, cart) + layout chrome + shadcn-svelte UI primitives
- Key files: `layout/Header.svelte`, `cards/CardGrid.svelte`, `ui/button/`, `ui/dialog/`

**`src/lib/stores/`:**
- Purpose: Client-side reactive state management using Svelte 5 runes
- Contains: `cart.svelte.ts` — the primary client store
- Key files: `cart.svelte.ts`

**`src/lib/auth/`:**
- Purpose: Auth-specific utilities safe to use on client and server (no Supabase server imports)
- Contains: OAuth conflict detection, structured error catalog
- Key files: `conflicts.ts`, `errors.ts`

**`src/params/`:**
- Purpose: SvelteKit route parameter matchers (custom type constraints for dynamic segments)
- Contains: `lang.ts` — matches 2–3 character ISO language codes
- Key files: `lang.ts`

**`supabase/migrations/`:**
- Purpose: PostgreSQL schema migrations applied via Supabase CLI
- Contains: Chronologically named `.sql` files
- Key files: Latest migration file (highest timestamp)

**`scripts/`:**
- Purpose: One-off operational and maintenance scripts run outside the web app
- Contains: Card sync, Google Photos batch conversion, API test scripts
- Key files: `sync-cards.ts`, `convert-gphoto-urls.ts`

**`tests/`:**
- Purpose: Global Vitest test infrastructure
- Contains: Setup file, shared mock factories
- Key files: `setup.ts`, `mocks/`

## Key File Locations

**Entry Points:**
- `src/hooks.server.ts`: Per-request Supabase client creation and auth resolution
- `src/routes/+layout.server.ts`: Root layout data loader (shared context for all pages)
- `src/routes/+layout.svelte`: Root layout component (auth listener, cart merge, shell UI)
- `src/app.html`: HTML document shell

**Configuration:**
- `svelte.config.js`: SvelteKit adapter (Vercel, Node 22) and path aliases (`$components`)
- `vite.config.ts`: Vite plugins and Vitest browser config
- `tailwind.config.js`: Tailwind content paths and theme extensions
- `tsconfig.json`: TypeScript settings (extends `.svelte-kit/tsconfig.json`)
- `components.json`: shadcn-svelte component registry config
- `src/app.d.ts`: Global TypeScript declarations for `App.Locals` and `App.PageData`

**Core Logic:**
- `src/lib/server/cart-service.ts`: All cart domain logic (CRUD, validation, merge)
- `src/lib/server/admin.ts`: Admin guards, service-role Supabase client factory
- `src/lib/server/pricing.ts`: Card-type price resolution with DB fallback
- `src/lib/server/notifications/service.ts`: Order notification dispatch
- `src/lib/stores/cart.svelte.ts`: Client-side cart reactive state
- `src/lib/admin-shared.ts`: Hardcoded admin Discord IDs and order status configuration

**Testing:**
- `src/lib/server/__tests__/`: Unit tests for server services (cart, exports, search)
- `src/lib/__tests__/`: Unit tests for shared lib (admin-shared, utils)
- `tests/setup.ts`: Vitest global setup (mocks, environment)
- `tests/mocks/`: Shared mock factories for Supabase, etc.
- `vitest.config.ts`: Test runner and coverage configuration

## Naming Conventions

**Files:**
- `+page.svelte`: SvelteKit page UI component
- `+page.server.ts`: Server-only data loader and form action file for a page
- `+layout.svelte`: Shared wrapper component for a route group
- `+layout.server.ts`: Server data loader for a route group (runs on every child page)
- `+server.ts`: API endpoint file (exports `GET`, `POST`, `PATCH`, `DELETE`)
- `*.svelte.ts`: Svelte 5 runes store (e.g., `cart.svelte.ts`, `is-mobile.svelte.ts`)
- `*.test.ts`: Vitest test file — co-located in `__tests__/` next to the file under test
- `[param]`: Dynamic route segment folder (e.g., `[id]/`, `[setCode]/`)

**Directories:**
- `__tests__/`: Test files co-located with source modules they test
- Feature grouping in `src/lib/server/` mirrors domain boundaries (cart, notifications, exports)
- `src/lib/components/ui/[name]/`: shadcn-svelte primitive, one folder per component family

## Where to Add New Code

**New Route/Page:**
- Create: `src/routes/[route-name]/+page.svelte`
- Server logic: `src/routes/[route-name]/+page.server.ts`
- If auth-required: add `if (!locals.user) throw redirect(303, '/auth/login?redirectTo=...')` at top of `load`
- Tests: `src/lib/__tests__/` or co-located `__tests__/` for server logic

**New Admin Page:**
- Create: `src/routes/admin/[feature]/+page.svelte`
- Server logic: `src/routes/admin/[feature]/+page.server.ts`
- Protected automatically by: `src/routes/admin/+layout.server.ts` admin guard

**New API Endpoint:**
- Implementation: `src/routes/api/[domain]/+server.ts`
- Export named handlers: `export const GET: RequestHandler = ...`, `export const POST: RequestHandler = ...`
- Admin-only endpoint: `src/routes/api/admin/[domain]/+server.ts` (add `isAdmin()` check in handler)

**New Component:**
- Feature component: `src/lib/components/[domain]/ComponentName.svelte`
- UI primitive (shadcn): `src/lib/components/ui/[name]/index.ts` (use shadcn-svelte CLI)
- Import with: `import ComponentName from '$components/[domain]/ComponentName.svelte'`

**New Server Service:**
- Implementation: `src/lib/server/[feature].ts`
- Class pattern preferred for stateful services; plain functions for stateless utilities
- Use `createAdminClient()` from `$lib/server/admin.ts` when needing to bypass RLS
- Never import this file in `.svelte` components or client-side code

**New Notification Type:**
- Add type to: `src/lib/server/notifications/types.ts`
- Add template to: `src/lib/server/notifications/templates.ts`
- Add preference key to: `NotificationPreferences` interface in `src/lib/server/notifications/service.ts`
- Map type to preference in: `TYPE_TO_PREFERENCE` in `service.ts`

**New Shared Type:**
- Domain type alias: `src/lib/server/types.ts` (for DB-derived types)
- Cart-specific type: `src/lib/server/cart-types.ts`
- Client+server safe constant/type: `src/lib/admin-shared.ts`

**New Utility Function:**
- Shared (client + server): `src/lib/utils.ts`
- Server-only utility: `src/lib/server/[utility].ts`
- Client async utility: `src/lib/utils/[utility].ts`

**New Database Migration:**
- File: `supabase/migrations/{timestamp}_{description}.sql`
- If adding a new table or column used in TypeScript: regenerate `src/lib/server/database.types.ts` via Supabase CLI (`supabase gen types`)

**New Maintenance Script:**
- Implementation: `scripts/[name].ts`

## Special Directories

**`src/lib/server/`:**
- Purpose: Server-only domain logic; enforced server/client boundary
- Generated: No (except `database.types.ts`)
- Committed: Yes

**`src/lib/server/database.types.ts`:**
- Purpose: Auto-generated Supabase TypeScript types from the live database schema
- Generated: Yes — via `supabase gen types typescript`
- Committed: Yes (snapshot of schema at generation time; regenerate after migrations)

**`coverage/`:**
- Purpose: Vitest code coverage output (HTML + JSON reports)
- Generated: Yes — via `vitest run --coverage`
- Committed: No (gitignored)

**`.svelte-kit/`:**
- Purpose: SvelteKit build artifacts, generated types (`$types`), and tsconfig extension
- Generated: Yes — automatically by `vite dev` / `vite build`
- Committed: No (gitignored)

**`supabase/migrations/`:**
- Purpose: SQL migrations for the Supabase PostgreSQL database
- Generated: No (hand-authored or via `supabase migration new`)
- Committed: Yes

**`.gsd/`:**
- Purpose: GSD planning and codebase mapping artifacts (this file lives here)
- Generated: Yes — by mapping agents
- Committed: Yes (project documentation)

---
*Structure analysis: 2026-03-14*
