---
status: ACTIVE
created: 2026-05-03
---

# PROJECT.md — MTG Group Buy Web App

## Vision

A modern web storefront for Magic: The Gathering proxy card group buys — letting customers browse, cart, and order cards while admins manage inventory and orders end-to-end.

---

## Goals

1. **Customer Storefront** — Browse catalog by set/finish, maintain persistent cart, checkout via PayPal.
2. **Admin Operations** — Full inventory management, order processing, group buy exports, notifications.
3. **Data Integrity** — Card catalog synced from MASTER CSV; duplicates surfaced; images cached from Ron's Google Photos.

---

## Tech Stack

- **Frontend**: SvelteKit + Svelte 5 (runes) + Tailwind CSS + shadcn-svelte
- **Backend**: SvelteKit server routes (SSR + API)
- **Database**: Supabase (PostgreSQL + RLS)
- **Auth**: Supabase Auth (Google, Discord OAuth)
- **Hosting**: Vercel

---

## Card Types

| Type | Serial Prefix | card_type values |
|------|--------------|-----------------|
| Normal | N- | Normal |
| Holo | H- | Holo |
| Foil | F- | Foil, Galaxy Foil, Raised Foil, Surge Foil |
| Serialized | — | Serialized |

Cards are uniquely identified by `set_code + collector_number + card_type`.

---

## Validated Requirements (v1.0 Shipped)

- [ ] Card catalog with search, set filter, finish filter, pagination
- [ ] Shopping cart (persistent, session-based)
- [ ] Deck import (Moxfield, Archidekt)
- [ ] Auth (Google + Discord OAuth)
- [ ] Order management (admin + customer views)
- [ ] Admin inventory (list, search, filter, bulk stock toggle, duplicate detection)
- [ ] Admin sync from MASTER CSV
- [ ] Admin image resync (Ron Google Photos cache)
- [ ] Group buy export
- [ ] Notifications (email + Discord)
- [ ] Card-type-aware pricing
- [ ] Galaxy Foil + hierarchical finish filtering
- [ ] Bulk tracking upload

---

## Completed Milestone: v1.2 Sets

**Goal:** Promote Sets to a first-class entity — admin CRUD for set management, admin card-association UI, public `/sets` listing + `/sets/[setCode]` detail pages, bundle cart + checkout.

**Shipped phases:** 17, 18, 19

*Completed: 2026-06-14*

---

## Current Milestone: v1.3 Sets Stacks View

**Goal:** Add a Stacks view mode to the set detail page (`/sets/[setCode]`) that replicates the Archidekt stacks UI — cards grouped by MTG expansion into vertical scrollable columns, with Scryfall set icons, inline image expand on click, and mobile accordion layout.

**Target features:**

- New `StacksView.svelte` component — column-per-expansion layout
- Columns grouped by `set_code`/`set_name` on cards, sorted by expansion name (natural sort)
- Column headers: Scryfall SVG set icon + expansion name + card count
- Compact rows: card name + `×N` duplicate badge
- Inline image expand per row; clicking image → card detail page
- Mobile: accordion (each column collapsible)
- View toggle extended: List | Grid | **Stacks**

*Started: 2026-06-15*
