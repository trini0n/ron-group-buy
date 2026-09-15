---
created: 2026-09-15T14:36:20-07:00
title: Group releases by Set — browse UI for set-based card grouping
area: ui
severity: minor
files: []
---

## Problem

Users are requesting a way to see card releases grouped by MTG Set. Currently there is no set-based grouping or filtering in the browse UI, making it harder to find cards from a specific release or understand what's available across sets.

The core pain point: when browsing the catalog, cards are presented without set-level organization, so users can't quickly answer "what's available from [Set X]?" or "when did this set release?"

## Solution

Brainstorm ideas for a set-grouping UI:

1. **Add release date to sets** — Store a release/availability date per set, enabling chronological sorting and "new arrivals" views grouped by set.

2. **Set-grouped browse view** — A view mode that groups cards under collapsible set headers (e.g., "Foundations", "Duskmourn") with set icon, release date, and card count.

3. **Set filter/sidebar** — A filterable set list in the sidebar or a dropdown that narrows the catalog to a specific set.

4. **Set landing pages** — Dedicated pages per set showing all available cards, set metadata (release date, total cards, availability %), and a visual set symbol.

5. **Timeline/carousel view** — A horizontal timeline or carousel of recent set releases, each linking to a filtered card grid.

6. **"New this week/month" grouping** — Auto-group cards by when they were added to the catalog, using the set release date as the grouping key.

Key design questions to resolve:
- Should grouping be the default browse mode or an opt-in view toggle?
- How prominent should set release dates be (subtle metadata vs. primary sort axis)?
- Should sets be visually branded (set symbols, colors) or kept minimal?
- Does this integrate with the existing search/filter system or live as a separate view?
