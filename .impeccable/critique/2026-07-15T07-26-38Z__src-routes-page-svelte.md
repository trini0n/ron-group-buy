---
target: src/routes/+page.svelte
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-07-15T07-26-38Z
slug: src-routes-page-svelte
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton loading excellent; no progress indicator for filter-applied states |
| 2 | Match System / Real World | 4 | MTG terminology natural throughout |
| 3 | User Control and Freedom | 3 | / shortcut, clear-all, view toggle present; no undo on cart-add from catalog |
| 4 | Consistency and Standards | 3 | Card items consistent; filter sidebar mixes accordion/flat inconsistently |
| 5 | Error Prevention | 2 | No indicator when active filters produce zero results before full render; "Non-Foil" label inconsistent with badge naming ("Normal"/"Holo") |
| 6 | Recognition Rather Than Recall | 3 | View toggle icons need tooltip (present but tooltip-only); active filter count badge helps |
| 7 | Flexibility and Efficiency | 3 | / keyboard shortcut is genuine; no bulk add-to-cart; no sort persistence |
| 8 | Aesthetic and Minimalist Design | 2 | Page lacks visual identity — pure shadcn scaffold, no personality; flat hierarchy between hero/search/sidebar |
| 9 | Error Recovery | 2 | Load error shows message but no retry; filter mismatch produces empty state with no guidance |
| 10 | Help and Documentation | 2 | is:TAG syntax invisible; no inline hint about / shortcut; no cross-link to deck import |
| **Total** | | **27/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** Yes, AI-generated. Specific tells: centered h1 hero on a product page, pure shadcn scaffold sidebar, view toggle copied from GitHub/Linear, no committed color anywhere, Inter weight-only hierarchy with no middle ground. The "Underground Mint" design personality from PRODUCT.md has not landed.

**Deterministic scan (detect.mjs):** 1 finding — `design-system-font-size` in CardItem.svelte line 171: `text-[10px]` off the type ramp.

## Priority Issues

**[P1] Hero section does no work** — centered "Card Catalog" heading + muted subtitle wastes 120px before search on a task-driven product page. Remove or collapse; lead with search.

**[P1] No visual identity above the card grid** — page is monochromatic shadcn-neutral throughout. The "underground but polished" personality from PRODUCT.md hasn't landed. MTG color identity buttons in filters should use committed mtg-* colors.

**[P2] Add-to-Cart is icon-only, buried** — h-8 w-8 icon button with tooltip as sole label fails mobile and reduces affordance for the primary catalog action.

**[P2] Filter sidebar label inconsistency** — "Non-Foil" filter sub-options say "No Holostamp"/"Holostamped"; card badges say "Normal"/"Holo". Different words for the same thing erodes result trust.

**[P2] is:TAG syntax invisible** — powerful Scryfall-style search exists but is completely undiscovered by users who haven't already typed "is:". No nudge, no hint.

## Persona Red Flags

**Alex (Power User):** is:TAG invisible; no bulk add-to-cart; no cross-link from catalog to /import for decklist users.

**Casey (Mobile):** Add-to-cart touch target is 32px (below 44px minimum); active filter indicator disappears when sidebar is collapsed on mobile; hero takes 120px before search on small viewports.

**The Deck Builder (Community-Specific):** No cross-link from catalog to /import; quantity defaults to 1 with no quick-set; cart feedback isolated to header badge (easy to miss when fast-scrolling).

## Minor Observations

- h1 "Card Catalog" vs title "Ron's Group Buy" — misaligned
- loadError exposes raw server error message
- View toggle buttons lack explicit aria-label (tooltip only — fails mobile/keyboard)
- CardGridSkeleton.svelte exists but page implements inline skeleton — two implementations
- 25 cards/page pagination only; no "load more" alternative
