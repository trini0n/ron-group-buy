---
phase: 16
name: Misprint Card Filter Type
created: 2026-05-25
---

# Phase 16 Context

## Vision

Misprint cards are a special category of cards with accidental printing errors or cards that don't exist as real paper MTG cards. They are hidden from the catalog, all search results, and decklist search by default. A dedicated opt-in "Misprint" checkbox in the filter panel makes them visible. The misprint flag originates in the Google Sheet library and flows in via sync.

## What's Essential

- Misprint cards are **excluded by default** from catalog, text/name search, and decklist search
- A **Misprint checkbox** at the bottom of the filter panel enables visibility, with a tooltip explaining what misprints are
- Misprint cards display a **chip/badge on CardItem** to indicate their status when visible
- Decklist search: misprint cards are excluded **unless they are the only matching version** of a card — in that case, surface with a warning
- Admin inventory **always shows misprint cards** (no toggle required for admins)
- The misprint flag is set via a **new column in the Google Sheet** (inserted between columns N and O) and synced to the DB; Google Apps Scripts in `docs/Ron/` must be updated to reference the new column
- Filter state **persists** across navigation and is reflected in the **URL params**
- Misprint filter **combines normally** with all other existing filters

## What's Flexible

- Exact visual styling of the Misprint chip on CardItem (color, label text)
- Tooltip copy (as long as it conveys: accidental errors / not real paper MTG cards)
- Whether the URL param key is `misprint=true` or similar

## What's Out of Scope

- Retroactively marking existing cards as misprint (only new synced cards going forward)
- Audit history / tracking when a card was marked misprint (boolean flag only)
- Any admin-side UI toggle to mark cards misprint (Google Sheet is the source of truth)
- Separate section for misprint cards in search results — they mix in with normal results when filter is on

## User Expectations

### Look and Feel

- Misprint checkbox sits at the **bottom of the existing filter panel**, following the same visual pattern as other checkboxes
- Checkbox has an **(i) or (?) icon** with a hover tooltip: "Misprint cards have accidental printing errors or do not exist as real paper MTG cards"
- No persistent banner or page-level indicator when filter is active — the **chip on each CardItem** is sufficient
- Mobile: follows same collapsed/expandable behavior as the rest of the filter panel

### Integration

- Filter panel: appended at the bottom, no changes to existing filter order
- CardItem: gains a Misprint chip (consistent with other card-type chips/badges)
- URL: filter state serialized into URL params alongside existing filters
- Google Sheet sync: new boolean column between N and O; Apps Script updated to map it
- Decklist search: special-case logic — exclude misprints, except when sole match (show with warning)
- Admin inventory: misprint cards always present, no filtering

## Questions Answered

| Question                                  | Answer                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Where does the Misprint filter live?      | Bottom of the existing filter panel                                    |
| Filter style?                             | Checkbox with (i)/(?) tooltip                                          |
| Visual indicator when filter is active?   | No banner — chip on each CardItem is sufficient                        |
| Mobile behavior?                          | Same pattern as existing filter panel                                  |
| How are cards flagged as misprint?        | New column in Google Sheet (between cols N and O); Apps Script updated |
| Existing cards marked as misprint?        | No — only new cards synced going forward                               |
| Admin inventory visibility?               | Always visible regardless of filter                                    |
| Audit history needed?                     | No — boolean flag only                                                 |
| Card detail page (/card/[id]) accessible? | Yes — standard misprint visual indicators shown                        |
| Decklist search behavior?                 | Excluded unless sole matching version — then surface with warning      |
| Filter persists across navigation?        | Yes                                                                    |
| Filter in URL params?                     | Yes                                                                    |
| Mixed with normal results when active?    | Yes — fully mixed, no separate section                                 |
| Combinable with other filters?            | Yes, all combinations work normally                                    |

## Constraints

- Misprint data source is the Google Sheet — no admin UI for flagging
- `docs/Ron/` Google Apps Scripts must be updated to handle the new column (column between N and O in the Library sheet)
- No breaking changes to existing filter panel behavior or URL param structure
