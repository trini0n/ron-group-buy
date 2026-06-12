---
updated: 2026-06-11
focus: arch
---

# STRUCTURE.md — MTG Group Buy Web App

## Overview

Full annotated directory tree for the SvelteKit project. The application follows SvelteKit's file-system routing conventions. All source code lives in src/. Database management is in supabase/. Build tooling and configuration are at the root.

---

## Full Directory Tree

`
group-buy/
|
|-- src/                          # All application source code
|   |-- app.html                  # HTML shell template (entry point)
|   |-- app.css                   # Global CSS (Tailwind base + custom tokens)
|   |-- app.d.ts                  # TypeScript ambient declarations (App.Locals, App.PageData)
|   |-- hooks.server.ts           # SvelteKit server hook — runs on every request
|   |                             #   Creates per-request Supabase client, attaches session
|   |
|   |-- params/                   # SvelteKit parameter matchers
|   |   +-- lang.ts               # Validates language code params (e.g., 'en', 'jp')
|   |
|   |-- routes/                   # SvelteKit file-based routing
|   |   |-- +layout.server.ts     # Root layout server load
|   |   |                         #   Fetches: group_buy_config, user profile, isAdmin, cardPrices
|   |   |-- +layout.svelte        # Root layout component (Header, Footer, cart store init)
|   |   |-- +page.server.ts       # Homepage server load
|   |   |                         #   In-memory cache (5-min), streaming card data, Scryfall dates
|   |   |-- +page.svelte          # Homepage (CardGrid/CardTableView, SearchFilters, pagination)
|   |   |
|   |   |-- auth/                 # Authentication pages
|   |   |   |-- callback/         # OAuth callback handler (code exchange, cookie set)
|   |   |   |-- login/            # OAuth sign-in page
|   |   |   |-- signup/           # Email sign-up
|   |   |   |-- logout/           # Sign-out action
|   |   |   |-- forgot-password/
|   |   |   +-- reset-password/
|   |   |
|   |   |-- cards/
|   |   |   +-- [serial]/         # Card detail page by serial number (e.g. N-001)
|   |   |
|   |   |-- card/
|   |   |   +-- [setCode]/
|   |   |       +-- [collectorNum]/ # Card detail by set+collector number
|   |   |
|   |   |-- cart/                 # Shopping cart page
|   |   |   |-- +page.server.ts   # Loads cart items from server
|   |   |   +-- +page.svelte      # Cart UI (line items, totals, checkout CTA)
|   |   |
|   |   |-- checkout/             # Checkout flow
|   |   |   |-- +page.server.ts   # Loads address data, validates cart
|   |   |   +-- +page.svelte      # Checkout form (address, shipping, order review)
|   |   |
|   |   |-- orders/               # Customer orders
|   |   |   |-- +page.server.ts   # Lists user's orders
|   |   |   |-- +page.svelte      # Order history list
|   |   |   +-- [id]/             # Single order detail
|   |   |
|   |   |-- import/               # Deck import tool
|   |   |   |-- +page.server.ts   # Minimal — import is client-driven
|   |   |   +-- +page.svelte      # Paste deck list, search, add-to-cart (55KB — largest page)
|   |   |
|   |   |-- profile/              # User profile
|   |   |   |-- +page.server.ts   # Loads user data + addresses
|   |   |   |-- +page.svelte      # Profile form + address management
|   |   |   +-- conflict/         # Address conflict resolution page
|   |   |
|   |   |-- account/              # Account settings
|   |   |   |-- +page.server.ts
|   |   |   +-- +page.svelte      # Auth settings, notification prefs
|   |   |
|   |   |-- admin/                # Admin section (protected by +layout.server.ts guard)
|   |   |   |-- +layout.server.ts # Admin auth guard + stats prefetch
|   |   |   |-- +layout.svelte    # Admin sidebar navigation
|   |   |   |-- +page.svelte      # Admin dashboard (order counts, user counts, stock)
|   |   |   |
|   |   |   |-- inventory/        # Card inventory management
|   |   |   |   |-- +page.server.ts
|   |   |   |   +-- +page.svelte  # Inventory table: search, filter, stock toggle, CheckNewCards
|   |   |   |
|   |   |   |-- orders/           # Order management
|   |   |   |   |-- +page.server.ts
|   |   |   |   |-- +page.svelte  # All orders table + bulk actions
|   |   |   |   +-- [id]/         # Single order: status transitions, notes, tracking
|   |   |   |
|   |   |   |-- users/            # User management
|   |   |   |   |-- +page.server.ts
|   |   |   |   |-- +page.svelte
|   |   |   |   +-- [id]/
|   |   |   |
|   |   |   +-- settings/         # Admin settings
|   |   |       |-- +page.server.ts
|   |   |       |-- +page.svelte  # Group buy config, pricing editor
|   |   |       |-- notifications/
|   |   |       +-- pricing/
|   |   |
|   |   +-- api/                  # JSON API endpoints (all +server.ts files)
|   |       |
|   |       |-- cart/
|   |       |   |-- +server.ts    # GET cart, POST add item
|   |       |   |-- [itemId]/     # PATCH quantity, DELETE item
|   |       |   |-- bulk/         # POST bulk-add items
|   |       |   |-- validate/     # POST validate cart (stock + price check)
|   |       |   |-- merge/        # POST merge guest cart into user cart
|   |       |   +-- checkout-session/
|   |       |
|   |       |-- orders/
|   |       |   |-- +server.ts    # POST create order
|   |       |   |-- [id]/         # GET single order
|   |       |   |-- bulk-status/  # PATCH bulk status update
|   |       |   +-- bulk-tracking/ # PATCH bulk tracking upload
|   |       |
|   |       |-- import/
|   |       |   |-- deck/         # POST parse + match deck list
|   |       |   +-- search/       # GET card name search
|   |       |
|   |       |-- profile/
|   |       |   |-- +server.ts    # PATCH profile update
|   |       |   |-- addresses/    # Address CRUD
|   |       |   |-- auth/         # Auth-related profile actions
|   |       |   |-- notifications/ # Notification prefs
|   |       |   +-- password/     # Password update
|   |       |
|   |       +-- admin/
|   |           |-- inventory/
|   |           |   |-- sync/          # POST sync cards from MASTER CSV
|   |           |   |-- resync-images/ # POST refresh Google Photos cache
|   |           |   |-- bulk/          # PATCH bulk stock toggle
|   |           |   +-- check-new/     # POST check for new/missing cards
|   |           |
|   |           |-- orders/
|   |           |   |-- [id]/          # PATCH update order status
|   |           |   |-- bulk-status/   # PATCH bulk status
|   |           |   +-- bulk-tracking/ # POST upload tracking numbers
|   |           |
|   |           |-- exports/
|   |           |   |-- groupbuy/      # GET group buy Excel export
|   |           |   +-- order/         # GET single order export
|   |           |
|   |           |-- users/             # Admin user management
|   |           |-- pricing/           # Card type price CRUD
|   |           |-- config/            # Group buy config management
|   |           |-- sync-alerts/       # Sync result notifications
|   |           +-- templates/         # Notification template management
|   |
|   +-- lib/                      # Shared library code ( alias)
|       |-- supabase.ts           # Supabase client factory (browser + server)
|       |-- utils.ts              # Shared client+server utilities
|       |                         #   cn(), formatPrice(), getCardPrice(),
|       |                         #   getFinishLabel(), FOIL_SUBTYPES, etc.
|       |-- utils/
|       |   +-- request-queue.ts  # Serialized async queue for cart API calls
|       |-- deck-utils.ts         # Deck parsing utilities (DeckCard, SearchResult types)
|       |-- admin-shared.ts       # Shared order status config (used client + server)
|       |                         #   ORDER_STATUS_CONFIG, getNextStatuses()
|       |-- data/
|       |   |-- countries.ts      # Country list + phone code data
|       |   +-- oracle-tags.ts    # Oracle tag definitions (is:shockland, etc.)
|       |
|       |-- hooks/
|       |   +-- is-mobile.svelte.ts  # Svelte 5 rune: mobile breakpoint detection
|       |
|       |-- auth/                 # Auth error/conflict utilities
|       |   |-- conflicts.ts      # Cart/session conflict types
|       |   +-- errors.ts         # Auth error types + messages
|       |
|       |-- stores/
|       |   +-- cart.svelte.ts    # Svelte 5 runes cart store
|       |                         #   CartItem, MergeReport, MergeStatus types
|       |                         #   Optimistic updates, server sync
|       |
|       |-- components/           # Svelte UI components
|       |   |-- cards/            # Card catalog components
|       |   |   |-- CardGrid.svelte      # Card grid view (filter + paginate)
|       |   |   |-- CardGridSkeleton.svelte # Loading skeleton
|       |   |   |-- CardItem.svelte      # Single card tile
|       |   |   |-- CardTableView.svelte # Table view of cards (sortable)
|       |   |   |-- IsTagAutocomplete.svelte # is:TAG search autocomplete dropdown
|       |   |   +-- SearchFilters.svelte # Filter panel (set, color, finish, frame, etc.)
|       |   |
|       |   |-- admin/
|       |   |   +-- CheckNewCardsModal.svelte # Admin tool: paste cards, find missing
|       |   |
|       |   |-- cart/
|       |   |   +-- CartMergeModal.svelte # Guest-to-user cart merge confirmation
|       |   |
|       |   |-- layout/
|       |   |   |-- Header.svelte        # Top nav (logo, cart icon, user menu)
|       |   |   |-- Footer.svelte        # Footer
|       |   |   +-- GroupBuyBanner.svelte # Active group buy status banner
|       |   |
|       |   |-- icons/             # Custom SVG icon components
|       |   |
|       |   +-- ui/                # shadcn-svelte primitives (27 component dirs)
|       |       |-- accordion/
|       |       |-- alert-dialog/
|       |       |-- avatar/
|       |       |-- badge/
|       |       |-- breadcrumb/
|       |       |-- button/
|       |       |-- card/
|       |       |-- checkbox/
|       |       |-- command/
|       |       |-- dialog/
|       |       |-- dropdown-menu/
|       |       |-- input/
|       |       |-- label/
|       |       |-- pagination/
|       |       |-- popover/
|       |       |-- radio-group/
|       |       |-- scroll-area/
|       |       |-- select/
|       |       |-- separator/
|       |       |-- sheet/
|       |       |-- sidebar/
|       |       |-- skeleton/
|       |       |-- sonner/
|       |       |-- switch/
|       |       |-- table/
|       |       |-- textarea/
|       |       |-- tooltip/
|       |       |-- CountrySelect.svelte # Country picker (standalone)
|       |       +-- PhoneInput.svelte    # Phone number input with country code
|       |
|       +-- server/               # Server-only code (never imported client-side)
|           |-- database.types.ts # Auto-generated Supabase TypeScript types
|           |-- types.ts          # Type aliases (Card, Order, CartItem, etc.)
|           |-- admin.ts          # Admin utilities
|           |                     #   createAdminClient(), isAdmin(), requireAdmin()
|           |-- cart-service.ts   # CartService class (get/add/remove/merge/validate)
|           |-- cart-types.ts     # Cart-related types (Cart, CartItem, MergeReport, etc.)
|           |-- card-identity.ts  # Card identity logic (set+cn+type key)
|           |-- export-builder.ts # Excel export generation (ExcelJS)
|           |-- gphoto-converter.ts # Google Photos URL conversion/caching
|           |-- logger.ts         # Pino-compatible server logger
|           |-- pricing.ts        # fetchPrices() + FALLBACK_PRICES
|           |-- search-utils.ts   # Server-side card search helpers
|           |-- set-release-dates.ts # Bundled set release date data (~25KB)
|           |-- user-profile.ts   # User profile fetch/update helpers
|           +-- notifications/    # Notification subsystem
|               |-- index.ts      # Re-exports
|               |-- service.ts    # NotificationService (email + Discord dispatch)
|               |-- discord.ts    # Discord webhook client
|               |-- templates.ts  # Email/Discord message templates
|               +-- types.ts      # Notification event types
|
|-- supabase/                     # Supabase project (database + config)
|   +-- migrations/               # 24 SQL migration files (chronological)
|       |-- 20260105000000_initial_schema.sql       # Tables: cards, users, orders, etc.
|       |-- 20260106000000_add_foil_type.sql
|       |-- 20260106100000_enhanced_carts.sql       # Guest carts, merge, versioning
|       |-- 20260106200000_admin_system.sql         # admins table, admin RLS
|       |-- 20260107000000_order_items_insert_policy.sql
|       |-- 20260108000000_add_shipping_type.sql
|       |-- 20260108_group_buy_orders.sql
|       |-- 20260109000000_optimize_rls_policies.sql
|       |-- 20260110000000_add_order_delete_policies.sql
|       |-- 20260111_add_paypal_email.sql
|       |-- 20260111_optimize_card_search.sql       # Search indexes
|       |-- 20260113000000_notifications_feature.sql
|       |-- 20260120_add_gphoto_url_cache.sql
|       |-- 20260120_optimize_admin_inventory.sql
|       |-- 20260131000000_add_card_identity_to_orders.sql
|       |-- 20260205203643_performance_indexes.sql
|       |-- 20260211_fix_security_vulnerabilities.sql
|       |-- 20260225_add_phone_number.sql
|       |-- 20260310000000_card_type_pricing.sql    # card_type_pricing table
|       |-- 20260310000001_backfill_raised_foil_serialized.sql
|       |-- 20260323000000_atomic_order_functions.sql # place_order RPC
|       |-- 20260413000000_fix_orders_update_rls.sql
|       |-- 20260526000000_add_is_misprint.sql      # Misprint flag + filter
|       +-- 20260527000000_add_misprint_prices.sql
|
|-- static/                       # Static assets (served as-is)
|
|-- tests/                        # Integration / e2e test files
|
|-- docs/                         # Project documentation
|
|-- scripts/                      # Agent/workflow tooling scripts
|   |-- search_repo.ps1/.sh       # Repo search helpers
|   |-- setup_search.ps1/.sh      # Search index setup
|   |-- validate-all.ps1/.sh      # Run all validators
|   |-- validate-skills.ps1/.sh   # Validate GSD skills
|   |-- validate-templates.ps1/.sh
|   +-- validate-workflows.ps1/.sh
|
|-- .planning/                    # GSD planning directory
|   |-- PROJECT.md                # Project vision, stack, goals
|   |-- ROADMAP.md                # Active milestone + phases
|   |-- REQUIREMENTS.md           # Feature requirements
|   +-- codebase/                 # Codebase mapping documents (this dir)
|
|-- package.json                  # Dependencies + npm scripts
|-- svelte.config.js              # SvelteKit config (adapter-vercel, aliases)
|-- vite.config.ts                # Vite config
|-- vitest.config.ts              # Vitest (unit tests) config
|-- tailwind.config.js            # Tailwind CSS config (custom colors, fonts)
|-- postcss.config.js             # PostCSS config
|-- tsconfig.json                 # TypeScript config
|-- components.json               # shadcn-svelte CLI config
|-- .env                          # Local secrets (not committed)
|-- .env.example                  # Env var documentation template
+-- .gitignore
`

---

## Naming Conventions

### Route Files (SvelteKit conventions)
| Pattern              | Purpose                                    |
|----------------------|--------------------------------------------|
| +page.svelte       | Page component (rendered in browser)       |
| +page.server.ts    | Page server load (SSR data fetching)       |
| +layout.svelte     | Layout component wrapping child routes     |
| +layout.server.ts  | Layout server load (shared data, guards)   |
| +server.ts         | API endpoint (GET/POST/PATCH/DELETE)       |
| [param]/           | Dynamic route segment                      |

### Component Files
| Pattern                      | Description                          |
|------------------------------|--------------------------------------|
| PascalCase.svelte          | All Svelte components                |
| ComponentName.svelte       | Feature components (e.g. CardItem) |
| ComponentNameModal.svelte  | Modal dialog components              |
| ComponentNameSkeleton.svelte | Loading skeleton variants          |
| index.ts                   | Barrel exports for component groups  |

### TypeScript Files
| Pattern                  | Description                            |
|--------------------------|----------------------------------------|
| kebab-case.ts          | Utility/service modules                |
| kebab-case.svelte.ts   | Svelte 5 runes stores (.svelte.ts)   |
| database.types.ts      | Auto-generated (do not hand-edit)      |
| 	ypes.ts               | Type alias barrel files                |

### Server vs. Client Boundary
| Location               | Boundary                               |
|------------------------|----------------------------------------|
| src/lib/server/      | Server-only (never imported by browser)|
| src/lib/stores/      | Client-side stores (.svelte.ts)      |
| src/lib/             | Shared (can be imported anywhere)      |
| src/routes/api/      | Server-only (API handlers)             |

---

## Module Boundaries

### What Can Import What

`
+page.svelte
  --> /components/**       (UI components)
  --> /stores/**           (client stores)
  --> /utils.ts            (shared utils)
  --> /admin-shared.ts     (shared constants)
  --> /deck-utils.ts       (shared parsing)
  --> /data/**             (static data)
  --> /hooks/**            (Svelte hooks)
  (CANNOT import /server/**)

+page.server.ts / +server.ts
  --> /server/**           (server services)
  --> /utils.ts            (shared utils)
  --> /admin-shared.ts     (shared constants)
  --> /supabase.ts         (client factory)
  --> /static/private      (secret env vars)
  (CAN import anything)

/server/**
  --> /server/**           (inter-server imports)
  --> /utils.ts            (shared utils)
  --> /admin-shared.ts
  (CANNOT import /stores/** or /components/**)

/components/**
  --> /utils.ts
  --> /stores/**
  --> /data/**
  --> /components/ui/**    (shadcn primitives)
  (CANNOT import /server/**)
`

### Key Module Descriptions

| Module                         | Exports / Purpose                               |
|--------------------------------|-------------------------------------------------|
| $lib/supabase.ts             | createSupabaseClient(), createSupabaseServerClient() |
| $lib/utils.ts                | cn(), getCardPrice(), getFinishLabel(), FOIL_SUBTYPES, ormatPrice(), serial parsing |
| $lib/admin-shared.ts         | ORDER_STATUS_CONFIG, getNextStatuses(), OrderStatus |
| $lib/deck-utils.ts           | DeckCard, SearchResult, TYPE_ORDER sort helper |
| $lib/data/oracle-tags.ts     | Tag definitions: is:shockland, is:fetchland, etc. |
| $lib/stores/cart.svelte.ts   | Singleton cart store with Svelte 5 runes         |
| $lib/server/admin.ts         | createAdminClient(), isAdmin(), equireAdmin(), isAdminRequest() |
| $lib/server/cart-service.ts  | CartService class (full cart lifecycle)         |
| $lib/server/pricing.ts       | etchPrices(), FALLBACK_PRICES               |
| $lib/server/export-builder.ts| Excel export builders for group buy + orders     |
| $lib/server/card-identity.ts | extractCardIdentity(), indCardsByIdentity()  |
| $lib/server/notifications/   | NotificationService, Discord + email dispatch  |
| $lib/server/database.types.ts| Generated Supabase DB types (auto-generated)     |
| $lib/server/types.ts         | Card, Order, CartItem, CardFilters, etc.  |

---

## Database Tables (from migrations)

| Table                | Purpose                                            |
|----------------------|----------------------------------------------------|
| cards              | Card catalog (serial, name, set, type, image, stock) |
| users              | User profiles (discord_id, name, avatar, paypal email) |
| dmins             | Admin Discord IDs (database-managed admins)        |
| carts              | Cart sessions (user_id or guest_id, version, expiry) |
| cart_items         | Individual cart line items (card_id, quantity, price) |
| orders             | Customer orders (status, shipping, timestamps)     |
| order_items        | Order line items (card snapshot: name, serial, price) |
| ddresses          | Saved shipping addresses per user                  |
| group_buy_config   | Active group buy window (opens_at, closes_at)      |
| card_type_pricing  | Per-type prices (Normal, Holo, Foil, Raised Foil, etc.) |
| 
otifications      | Notification log/queue                             |

---

## Environment Variables

| Variable                  | Side    | Purpose                                 |
|---------------------------|---------|------------------------------------------|
| PUBLIC_SUPABASE_URL     | Public  | Supabase project URL                     |
| PUBLIC_SUPABASE_ANON_KEY| Public  | Supabase anon (public) API key           |
| SUPABASE_SERVICE_ROLE_KEY | Private | Service role key (admin client only)   |
| ADMIN_DISCORD_IDS       | Private | Comma-separated hardcoded admin Discord IDs |
| ADMIN_EMERGENCY_UUIDS   | Private | Emergency admin access by Supabase UUID  |

---

## Build / Dev Scripts

| Script              | Command                              | Purpose                              |
|---------------------|--------------------------------------|--------------------------------------|
| dev               | ite dev                           | Local dev server                     |
| uild             | ite build                         | Production build                     |
| check             | svelte-kit sync && svelte-check    | Type-check all Svelte files          |
| 	est              | itest                             | Run unit tests (watch mode)          |
| 	est:unit         | itest run                         | Run unit tests once                  |
| 	est:ci           | itest run --coverage              | CI tests with coverage               |
| db:generate       | supabase gen types typescript      | Regenerate database.types.ts       |
| db:push           | supabase db push                   | Apply pending migrations             |
| db:reset          | supabase db reset                  | Reset local DB                       |
| sync:cards        | 	sx scripts/sync-cards.ts          | Manual card catalog sync from CSV    |
