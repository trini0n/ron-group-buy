---
phase: 17
plan: 1
status: complete
---

# Plan 17.1 Summary — DB Migration + Admin Sets List + Nav Link

## What Was Built

### DB Migration (`supabase/migrations/20260614000000_sets_table.sql`)
- `sets` table: `set_code TEXT PK`, `set_name TEXT NOT NULL`, `sort_order INTEGER DEFAULT 0`, `created_at`, `updated_at`
- `set_cards` join table: `id UUID PK`, `set_code FK → sets(ON DELETE CASCADE)`, `card_id FK → cards(ON DELETE CASCADE)`, `UNIQUE(set_code, card_id)`
- Indexes: `idx_set_cards_set_code`, `idx_set_cards_card_id`, `idx_sets_sort_order`
- RLS: both tables publicly readable via SELECT policy; writes go through service role only

### API Routes
- `GET /api/admin/sets` — list all sets with `set_cards(count)`, ordered by sort_order + set_name
- `POST /api/admin/sets` — create set (set_code uppercased, 409 on duplicate)
- `PATCH /api/admin/sets/[setCode]` — update set_name and/or sort_order
- `DELETE /api/admin/sets/[setCode]` — delete set (cascades set_cards)

### Admin Sets List Page (`/admin/sets`)
- Table: Set Code badge | Set Name (link to detail) | Card Count | Edit/Delete actions
- Inline create form (Add Set button toggle): set_code + set_name inputs
- Inline edit: click pencil → input replaces name cell, save with Enter or ✓ button
- Delete: window.confirm with card count in message → DELETE API → invalidateAll
- Empty state: Library icon + instructional text
- All operations use toast for success/error feedback

### Admin Nav
- `Library` icon from lucide-svelte added to admin sidebar
- "Sets" nav item added between Inventory and Settings

## Requirements Satisfied
SETS-01, SETS-02, SETS-03, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04 (sort_order stored), ADMIN-05, NAV-02

## Commits
- `f1d08f0` feat(phase-17): add sets and set_cards DB migration
- `8602d48` feat(phase-17): add admin sets CRUD API routes
- `eaf396b` feat(phase-17): admin sets list page and sidebar nav link
