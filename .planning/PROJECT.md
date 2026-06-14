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

## Current Milestone: v1.2 Sets

**Goal:** Promote Sets to a first-class entity — admin CRUD for set management, admin card-association UI (`setCode coll# lang` textarea input), and public `/sets` listing + `/sets/[setCode]` detail pages.

**Target features:**

- `sets` table (`set_code` PK, `set_name`, `sort_order`) + `set_cards` join table
- Admin: create / edit / delete / reorder sets
- Admin: paste `setCode coll# lang` lines to associate cards with a set; error report for unresolvable lines
- Public `/sets` page: lists all sets (sorted by `sort_order` then `set_name`), card count per set
- Public `/sets/[setCode]` page: shows curated card list (sorted by release date → collector number), links to card detail pages

*Last updated: 2026-06-14*
