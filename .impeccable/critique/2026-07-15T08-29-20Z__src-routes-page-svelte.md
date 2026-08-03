---
target: src/routes/+page.svelte
total_score: 27
p0_count: 0
p1_count: 1
timestamp: 2026-07-15T08-29-20Z
slug: src-routes-page-svelte
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton loading ✓; no micro-state between filter interaction and result update |
| 2 | Match Between System and Real World | 3 | is:fetchland placeholder is perfect MTG vocab; Frame Type label diverges from card badge text |
| 3 | User Control and Freedom | 3 | Clear per-section ✓; undo absent; back-nav with replaceState silently breaks filter restoration |
| 4 | Consistency and Standards | 3 | Layout system internally coherent; H1 weight barely clears filter label tier |
| 5 | Error Prevention | 2 | No guard when deselecting all finish subtypes produces 0 results; back-nav foot-gun; no active filter visibility near results |
| 6 | Recognition Rather Than Recall | 3 | Count badge helps; but no filter chips near results — active filters invisible on scroll / mobile |
| 7 | Flexibility and Efficiency | 3 | / shortcut ✓; is: autocomplete ✓; sort buried in sidebar (convention: above results) |
| 8 | Aesthetic and Minimalist Design | 3 | Spare and controlled ✓; all accordions open by default presents 15+ choices before first interaction |
| 9 | Error Recovery | 2 | Error state ✓ with Refresh; empty state has no inline Clear all filters CTA; loadError forwards raw error.message to UI |
| 10 | Help and Documentation | 2 | Placeholder teaches is:TAG syntax while box is empty; Misprint tooltip is great; rest has no contextual help |
| **Total** | | **27/40** | **Functional — specific gaps remain** |

## Anti-Patterns Verdict

**LLM assessment:** No longer "AI made this" at first glance. The centered hero is gone. The gold focus ring is a committed, documented, non-arbitrary accent used exactly once. The is:fetchland placeholder is domain-specific. The finish segment control is a custom interaction that belongs to no other product in this category.

Residual tells: empty state is still the classic AI template (centered, py-16, zero personality, no recovery CTA). All accordions open is default shadcn behaviour — not customized.

**Deterministic scan:** 0 absolute-ban violations across all five files. Confirmed clean: no gradient text, no side-stripe borders, no sketchy SVG, no stripe backgrounds, no 32px+ card radii.

**Code-level findings from independent assessment:**
- min-h-[3.5rem] in CardItem.svelte:150 — has direct scale equivalent (min-h-14). Cosmetic.
- Touch targets: h-8 (32px) on add-to-cart, view toggle buttons; h-7 (28px) on quantity ± buttons; 32px on color identity mana pips — all below WCAG 2.5.5 44px minimum.
- role="button" mobile filter toggle (SearchFilters.svelte:289) missing aria-expanded and Space key handler.
- Both reduced-motion guards correctly implemented. ✓

## Priority Issues

**[P1] Empty state: no recovery path, no personality**
"No cards found / Try adjusting your search or filters" has no inline escape. User who over-filters hits a dead end with no Clear all filters link, no hint of which filter removed cards. Underground Mint persona disappears at this moment.
Fix: Add inline "Clear all filters" button in empty state. Optionally list active filters: "No results for: Red · Land · Retro Frame."
Suggested command: $impeccable clarify

**[P2] Touch targets sub-44px across three components**
Add-to-cart h-8 (32px), quantity ± h-7 (28px), view toggle h-8 w-8 (32px), color identity mana pips (32px) — all below WCAG 2.5.5 minimum.
Fix: min-h-[44px] wrapper/padding or nudge button sizes. View toggle: p-1.5 + h-9 w-9.
Suggested command: $impeccable adapt

**[P2] role="button" mobile filter toggle missing aria-expanded + Space key**
onkeydown fires only on Enter (not Space). aria-expanded absent. Screen reader users hear "button" with no open/closed state. WCAG 4.1.2 failure.
Fix: Add aria-expanded={mobileFiltersOpen}. Add `|| e.key === ' '` to the keydown handler.
Suggested command: $impeccable audit

**[P2] All accordion sections open by default — 15+ choices on first render**
Card Type (8), Finish (3), Frame Type (4) all visible immediately. 15 discrete choices before any filter is touched.
Fix: Default Card Type and Frame Type Accordion.Item to closed. Keep Sort, Set, Color, Finish open.
Suggested command: $impeccable distill

**[P3] loadError forwards raw error.message to the UI**
Pattern violates AGENTS.md: never expose internal error strings. Current hardcoded copy is correct — confirm catch block doesn't interpolate raw error anywhere.
Suggested command: $impeccable harden

## Persona Red Flags

**Alex (power user):** / shortcut and is:TAG autocomplete are right. URL-encoded state means shareable Discord links. Red flag: Sort in sidebar, not above grid. Back-button filter-loss hits Alex during deep browsing sessions (replaceState).

**Casey (mobile):** Filters default collapsed — correct. But toggle missing aria-expanded and Space key (B-confirmed). Search bar h-11 meets target; view toggle h-8 w-8 (32px) does not. "Card Catalog / Got a decklist?" header row needs testing at 375px width.

**The Deck Builder:** Import link is most important feature for this persona — right-justified text-sm text-muted-foreground microcopy. First-time users will search card-by-card for 5 minutes before noticing it. replaceState back-nav issue hits this persona hardest (card→detail→back→card→detail loses scroll and search state).

## Minor Observations

- aspect-[488/680] on skeleton vs aspect-[2.5/3.5] on cards — numerically identical (≈0.718) but expressed differently; unify
- min-h-[3.5rem] in CardItem.svelte:150 → replace with min-h-14
- Info icon on Misprint tooltip is h-3.5 w-3.5 — nudge to h-4 w-4
- Color identity Only/Any of toggle (bg-foreground text-background) is jarring next to muted checkboxes
- loadError raw error.message interpolation is a security concern per AGENTS.md
- .card-hover unconditional transition-all duration-200 base rule is a latent risk if hover-color classes added outside the reduced-motion guard

## Questions to Consider

- Is sort-in-sidebar intentional? Document it or move it above the grid.
- Does back button actually restore filters? replaceState — tested on mobile Safari?
- Should "Import it →" be promoted from microcopy to a secondary button in the search strip?
- Should accordion open/closed state be driven by whether any filter in that section is active?
