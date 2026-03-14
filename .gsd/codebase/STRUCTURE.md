# STRUCTURE.md — Directory Structure

## Root

```
group-buy/
├── src/                    # Application source
├── static/                 # Static assets (images, etc.)
├── supabase/
│   └── migrations/         # SQL migration files
├── scripts/                # One-off and maintenance scripts
├── tests/                  # Global test setup and shared mocks
├── .gsd/                   # GSD planning artifacts
├── coverage/               # Vitest coverage output (gitignored)
├── svelte.config.js        # SvelteKit + Vite config (adapter, aliases)
├── vite.config.ts          # Vite plugins
├── tailwind.config.js      # Tailwind theme + content paths
├── postcss.config.js
├── tsconfig.json           # TypeScript (extends .svelte-kit/tsconfig.json)
├── vitest.config.ts        # Test runner config
├── components.json         # shadcn-svelte config
└── package.json
```

## `src/` Tree

```
src/
├── app.html                # HTML shell (SvelteKit entry)
├── app.d.ts                # Global App typings (Locals, PageData)
├── app.css                 # Global Tailwind + theme CSS
├── hooks.server.ts         # Per-request bootstrap (Supabase + auth)
│
├── params/
│   └── lang.ts             # Route matcher for optional language segment
│
├── lib/                    # Shared application code
│   ├── supabase.ts         # Supabase client factories (browser + server)
│   ├── utils.ts            # Shared utility functions (URLs, formatting, sorting)
│   ├── deck-utils.ts       # Deck text parsing helpers
│   ├── admin-shared.ts     # Shared admin config (status config, admin IDs)
│   │
│   ├── auth/
│   │   ├── conflicts.ts    # Account/identity conflict detection
│   │   └── errors.ts       # Structured auth error catalog
│   │
│   ├── components/
│   │   ├── cards/          # Card catalog UI (CardGrid, SearchFilters, etc.)
│   │   ├── cart/           # Cart UI (CartMergeModal.svelte)
│   │   ├── layout/         # Shell UI (Header, Footer, GroupBuyBanner)
│   │   ├── icons/          # Icon components (ManaIcon.svelte, etc.)
│   │   └── ui/             # shadcn-style primitives (button, dialog, table,
│   │                       #   sidebar, accordion, badge, etc.)
│   │
│   ├── data/
│   │   └── countries.ts    # Country + dial-code data
│   │
│   ├── hooks/
│   │   └── is-mobile.svelte.ts  # Media query reactive helper
│   │
│   ├── stores/
│   │   └── cart.svelte.ts  # Client cart store (server sync, localStorage, optimistic)
│   │
│   ├── utils/
│   │   └── request-queue.ts  # Serializes concurrent async cart requests
│   │
│   ├── server/             # Server-only code (never imported in +page.svelte)
│   │   ├── database.types.ts     # Generated Supabase schema types
│   │   ├── types.ts              # Domain types (Card, PaginatedResult, etc.)
│   │   ├── cart-types.ts         # Cart/order types and constants
│   │   ├── admin.ts              # Admin guards + service-role client
│   │   ├── pricing.ts            # Card price strategy
│   │   ├── cart-service.ts       # Cart/order domain logic
│   │   ├── card-identity.ts      # Card identity matching + duplicate resolution
│   │   ├── search-utils.ts       # Import/search helpers
│   │   ├── set-release-dates.ts  # MTG set release date map + comparators
│   │   ├── gphoto-converter.ts   # Google Photos URL conversion + DB cache
│   │   ├── export-builder.ts     # Excel/export file generation
│   │   ├── export-storage.ts     # Export file retention + manifest
│   │   ├── logger.ts             # Structured logger
│   │   ├── notifications/
│   │   │   ├── service.ts        # Notification dispatch orchestration
│   │   │   ├── discord.ts        # Discord DM transport
│   │   │   ├── templates.ts      # Notification template logic
│   │   │   └── types.ts          # Notification types
│   │   └── __tests__/            # Unit tests for server modules
│   │
│   └── __tests__/          # Unit tests for shared lib modules
│
└── routes/
    ├── +layout.server.ts   # Root: session, prices, config, isAdmin
    ├── +layout.svelte      # Root shell: Header, Footer, auth sync, cart modal
    ├── +page.server.ts     # Home: card catalog + streamed data
    ├── +page.svelte        # Home: card catalog UI
    │
    ├── account/            # Account management
    ├── auth/
    │   ├── login/          # Login page
    │   ├── signup/         # Signup page
    │   ├── callback/       # OAuth callback handler (+server.ts)
    │   ├── logout/         # Logout handler (+server.ts)
    │   └── confirm/        # Email confirmation handler
    ├── cart/               # Cart page
    ├── checkout/           # Checkout page
    ├── orders/             # Order history
    ├── profile/            # User profile + linked accounts
    │
    ├── admin/
    │   ├── +layout.server.ts  # Admin auth guard
    │   ├── +layout.svelte     # Admin shell UI
    │   ├── orders/            # Order management
    │   ├── users/             # User management
    │   ├── inventory/         # Card inventory management
    │   ├── exports/           # Data export management
    │   └── config/            # Group buy configuration
    │
    ├── import/
    │   ├── +page.svelte       # Deck import UI
    │   └── __tests__/         # Deck parsing tests
    │
    └── api/
        ├── cart/              # Cart CRUD endpoints
        │   ├── +server.ts     # GET cart
        │   ├── [itemId]/      # PATCH/DELETE item
        │   ├── merge/         # POST merge guest→user cart
        │   └── claim/         # POST claim guest cart
        ├── orders/            # Order creation + management
        │   ├── +server.ts     # POST create order
        │   └── [id]/
        │       └── pending/   # Convert pending order
        ├── import/
        │   ├── deck/          # POST import from Moxfield/Archidekt
        │   └── search/        # POST search card catalog
        ├── profile/
        │   ├── addresses/     # Address CRUD
        │   └── auth/          # OAuth link/unlink (google, discord)
        └── admin/
            ├── orders/        # Admin order status + notifications
            ├── users/         # Admin user management
            ├── inventory/     # Inventory sync + image resync
            ├── pricing/       # Admin pricing backfill
            └── exports/       # Export generation + cleanup
```

## File Naming Conventions

| Pattern             | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `+page.svelte`      | Page UI component                             |
| `+page.server.ts`   | Server-only data loader + auth guard          |
| `+layout.svelte`    | Shared UI wrapper for route group             |
| `+layout.server.ts` | Shared server data for route group            |
| `+server.ts`        | API endpoint (GET/POST/PATCH/DELETE handlers) |
| `*.svelte.ts`       | Svelte 5 runes store (e.g. `cart.svelte.ts`)  |
| `__tests__/`        | Test files co-located with source             |

## Where to Put New Code

| New thing             | Location                                                     |
| --------------------- | ------------------------------------------------------------ |
| New page              | `src/routes/{name}/+page.svelte` + `+page.server.ts`         |
| New API endpoint      | `src/routes/api/{domain}/+server.ts`                         |
| Reusable UI component | `src/lib/components/{domain}/ComponentName.svelte`           |
| shadcn primitive      | `src/lib/components/ui/{name}/`                              |
| Server-only service   | `src/lib/server/{feature}.ts`                                |
| Shared type           | `src/lib/server/types.ts` or domain-specific types file      |
| Client store          | `src/lib/stores/{name}.svelte.ts`                            |
| Utility function      | `src/lib/utils.ts` (if generic) or `src/lib/utils/{name}.ts` |
| DB migration          | `supabase/migrations/{timestamp}_{description}.sql`          |
| Maintenance script    | `scripts/{name}.ts`                                          |

## Import Aliases

| Alias                 | Resolves To                                          |
| --------------------- | ---------------------------------------------------- |
| `$lib`                | `src/lib/`                                           |
| `$components`         | `src/lib/components/` (custom in `svelte.config.js`) |
| `$app/*`              | SvelteKit app utilities                              |
| `$env/static/public`  | Public env variables                                 |
| `$env/static/private` | Private env variables (server only)                  |
