---
milestone: v1.3
created: 2026-06-15
status: planning
---

# REQUIREMENTS.md — v1.3 Sets Stacks View

## Context

The `/sets/[setCode]` detail page currently offers two view modes: **List** (plaintext) and **Grid** (the existing CardGrid with full enriched card tiles). This milestone adds a third view mode — **Stacks** — modelled after Archidekt's stacks UI.

In Stacks view, cards within a set are **grouped into vertical columns by their MTG expansion** (the `set_code` field on each card, e.g. `MH3`, `OTJ`, `MKM`). Each column shows a compact scrollable list of card names with duplicate-count badges. Clicking a row reveals the full card image in an inline expand; clicking the image navigates to the card detail page.

---

## Decisions Captured

| Decision | Choice | Rationale |
|---|---|---|
| Stacks grouping | MTG expansion (`set_code` + `set_name` on card) | Cards in a bundle set come from multiple MTG sets; expansion is the most natural grouping for this context |
| Expanded card info | Image only — no price/cart controls | Keeps the view clean; users navigate to card detail for purchasing |
| Duplicate handling | Collapse same card into one row with `×N` badge | Avoids visual noise when multiple copies appear |
| Mobile layout | Each column is a collapsible accordion | Prevents horizontal scroll hell on mobile |
| Set symbol icons | Scryfall SVG set symbol in column header | Visually identifies the expansion at a glance |
| Default view mode | List (unchanged) | Stacks is opt-in via the view toggle |
| Sort within column | Collector number (numeric-aware ASC) | Consistent with existing card sort behaviour |
| Sort of columns | Natural sort on `set_name` (numeric-aware, same algorithm as sets listing) | Keeps expansions in consistent order |

---

## Requirements

### STACKS-01 — View Toggle
The existing List / Grid toggle on `/sets/[setCode]` gains a third option: **Stacks**. The toggle renders as `List | Grid | Stacks`. Default remains List.

### STACKS-02 — Column Grouping
In Stacks view, cards are grouped by their `set_code` field (the MTG expansion the physical card belongs to, e.g. `mh3`, `otj`). Each expansion becomes one column.

### STACKS-03 — Column Header
Each column header displays:
- The Scryfall set symbol SVG (`https://svgs.scryfall.io/card-symbols/{set_code}.svg`) with graceful fallback if the SVG 404s
- The expansion name (`set_name` from the card, e.g. "Modern Horizons 3")
- The total card count for that column (counting duplicates)

Columns are sorted by expansion name using the same natural/numeric-aware sort as the sets listing page.

### STACKS-04 — Compact Card Rows
Within each column, cards are listed as compact rows sorted by `collector_number` (numeric-aware ASC). Each row shows:
- Card name
- A `×N` count badge if there are multiple copies of the same card (same `card_name` + same `card_type`) in this column
- No mana cost (not stored in the DB)

"Same card" for deduplication purposes: same `card_name` AND same `card_type` (finish). Cards with the same name but different finishes (Normal vs Foil) are separate rows.

### STACKS-05 — Inline Image Expand
Clicking a row within a column expands a card image inline within that column (pushing rows below down). Only one card can be expanded per column at a time. Clicking the same row again collapses it. Clicking a different row in the same column collapses the old one and expands the new one.

The image uses the same priority chain as `CardItem.svelte`:
1. `ron_image_url` if set and not errored
2. Scryfall image via `scryfall_id` at `normal` size
3. `/images/card-placeholder.png` fallback

### STACKS-06 — Image Navigation
Clicking the expanded card image navigates to `/card/[serial]` (the existing card detail page). The image is wrapped in an `<a>` tag.

### STACKS-07 — Mobile Accordion
On mobile (< `sm` breakpoint), columns render vertically as accordions. Each column header is a toggle button; clicking it collapses/expands its card list. All columns start expanded. Desktop shows all columns in a horizontal scroll container side-by-side.

### STACKS-08 — Empty Column Guard
If a card in `set_cards` lacks a `set_code` or `set_name`, it is grouped into a catch-all column labelled **"Unknown Set"** with no icon.

### STACKS-09 — No regressions
List and Grid view modes remain fully functional. No changes to `CardGrid.svelte` or `CardItem.svelte`.

---

## Out of Scope

- Sorting columns by anything other than expansion name (no user-controlled sort in v1.3)
- Filtering within Stacks view (search bar, finish filter etc.)
- Mana cost display (not stored in DB)
- Price/cart controls within Stacks view
- Drag-and-drop reordering
