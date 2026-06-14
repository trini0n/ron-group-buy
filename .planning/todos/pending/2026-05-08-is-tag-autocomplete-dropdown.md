---
created: 2026-05-08T11:35
title: Add is:TAG autocomplete dropdown in search bar
area: ui
files:
  - src/routes/+page.svelte
  - src/lib/components/cards/SearchFilters.svelte
  - src/lib/data/oracle-tags.ts
---

## Problem

When a user begins typing is: in the search bar, two UX problems exist:
1. The partial token is: (with no tag yet) causes the filter function to try to match an empty/unknown tag, likely returning zero results instead of behaving as if no oracle tag filter is active.
2. There is no discovery mechanism — users have no way to know what valid is:TAG values exist without reading documentation.

## Solution

Two behaviors when user types is: (or is:partial) in the search bar:

**1. Partial token passthrough**: While the is: token is incomplete (no space yet after the value, or the typed value matches no known tag), treat it as a no-op for filtering — apply only the other active filters as if the partial token weren't there.

**2. Autocomplete dropdown**: Show an alphabetical list of available oracle tags below the search input whenever the cursor is within an is:partial token. List filters as the user types more characters after is:. Selecting an option autofills the complete token (e.g. is:shockland). List dismisses on: option selected, Space keypress, or click outside. Reuse ORACLE_TAG_LABELS from oracle-tags.ts for display names (e.g. show "Shock Lands" but insert is:shockland).
