---
quick_id: "260918-1wy"
description: "Add cart controls to StacksView cards, set details Add Set button, sets listing click-through"
status: complete
date: "2026-09-18"
commit: a16c98e
---

# Summary

## What Changed

### 1. StacksView — Hover Cart Overlay (`StacksView.svelte`)
- Added a cart overlay at the bottom of each card in the stacks view
- **Quantity stepper**: −/+/number display for setting quantity (1-99)
- **Add to Cart button**: Adds the card to cart with the selected quantity; shows toast on success/failure
- **Transparency**: Overlay is invisible by default, semi-transparent (60% opacity) on card hover, fully opaque when the overlay itself is hovered — so card image and text remain visible
- Per-card quantity state tracked in a reactive `Record<string, number>` keyed by row dedup key
- All overlay clicks use `preventDefault` + `stopPropagation` to avoid triggering card navigation

### 2. Set Details Page — Add Set to Cart Button (`/sets/[setCode]`)
- Added "Add Set to Cart" button in the header next to the view mode toggle (Stacks/List)
- Uses `cartStore.addBundle()` to add the entire set as a bundle
- Button is disabled while adding and hidden when no price is set
- Shows toast on success/failure

### 3. Sets Listing Page — Clickable Set Cards (`/sets`)
- Converted set card wrapper from `<div>` to `<a>` so the entire card navigates to `/sets/{setCode}`
- Removed the inner `<a>` around the set name (now redundant)
- Add to Cart button uses `e.preventDefault()` + `e.stopPropagation()` to prevent navigation when clicked

## Verification

- `svelte-check --threshold error` → **0 errors**, 1 warning (pre-existing)
