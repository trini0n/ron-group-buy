---
name: Group Buy — MTG Proxy Shop
description: Community-run bootleg MTG proxy group-buy app for Discord-native buyers
colors:
  void: "#09090b"
  surface: "#09090b"
  surface-raised: "#18181b"
  surface-muted: "#27272a"
  ink: "#fafafa"
  ink-muted: "#a1a1aa"
  ink-faint: "#71717a"
  border: "#27272a"
  primary: "#fafafa"
  primary-bg: "#09090b"
  destructive: "#dc2626"
  success: "#16a34a"
  warning: "#d97706"
  mtg-gold: "#C9A964"
  mtg-red: "#D3202A"
  mtg-blue: "#0E68AB"
  mtg-green: "#00733E"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-bg}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#e4e4e7"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  badge-default:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: Group Buy — MTG Proxy Shop

## 1. Overview

**Creative North Star: "The Underground Mint"**

Factory-floor confidence — not a storefront, a press. Cards roll off, prices are posted on the wall, and there's no ceremony between browsing and buying. This system doesn't explain itself, doesn't decorate itself, and doesn't apologize for what it sells. It operates with the quiet authority of a place that's been doing this long enough to have it figured out.

The visual register is dark, dense, and precise. The chrome is minimal so the cards can breathe. Typography does the heavy lifting: weights shift to create hierarchy instead of color doing the job. Accent color is used with restraint — it appears on primary actions and state indicators only, never as decoration.

What this system explicitly rejects: the generic TCGO-style storefront (TCGPlayer clone aesthetic, "official card store" optimism), cheap proxy sites (watermarks, discount-bin energy, awkward layout), and the overdesigned SaaS dashboard (feature-announcement chrome, corporate coldness). This is neither an authoritative retailer nor a slapped-together fansite. It's a precision tool built for people who play the game.

**Key Characteristics:**
- Dark by default, always — not a theme, the identity
- Information-dense layouts with tight vertical rhythm
- One neutral palette; color appears as state, not decoration
- MTG color identities used for card-attribute display, never for chrome
- Card imagery is the hero; the UI is the frame
- Fast, direct navigation — the user knows what they want

## 2. Colors

A near-monochromatic dark neutral stack. Depth is created through tonal layering, not shadows.

### Primary
- **Near-White Ink** (`#fafafa`): Primary action color and foreground text. On dark backgrounds this is used for buttons, focused states, and high-emphasis text. Its rarity as a "color" is what gives it weight.

### Neutral
- **Void** (`#09090b`): The body background and card background — a near-black blue-black that reads as neutral in dark context.
- **Raised Surface** (`#18181b`): Elevated panels, sidebar backgrounds, popover surfaces. One step above the void.
- **Muted Surface** (`#27272a`): Secondary panels, inactive tabs, skeleton backgrounds, dividers, border strokes. The system's mid-tone.
- **Muted Ink** (`#a1a1aa`): Secondary text — labels, helper copy, metadata. Must hit 4.5:1 against the void background.
- **Faint Ink** (`#71717a`): Tertiary metadata only. Never used for information the user needs to act on.
- **Border** (`#27272a`): 1px strokes between surfaces. Same as muted surface — no separate border color is needed.

### Tertiary (Semantic)
- **Destructive Red** (`#dc2626`): Errors, destructive actions, out-of-stock overlays.
- **Success Green** (`#16a34a`): In-stock states, successful actions, group-buy-open banner.
- **Warning Amber** (`#d97706`): Group-buy-closed and scheduled-state banners.

### MTG Color Identities (attribute display only)
- **Gold** (`#C9A964`): Multi-color / gold cards
- **Red** (`#D3202A`): Red-identity cards
- **Blue** (`#0E68AB`): Blue-identity cards
- **Green** (`#00733E`): Green-identity cards

**The Identity Quarantine Rule.** MTG color identity values (`mtg-*`) are restricted to card-attribute badges and mana symbol indicators. They are prohibited in navigation, buttons, backgrounds, or any chrome element. Using them outside card attributes conflates game vocabulary with interface vocabulary.

**The One-Accent Rule.** The primary white (`#fafafa`) is used on ≤10% of any given screen — primary buttons, current selection highlights, and active states. Its rarity is what makes it legible as an action signal.

## 3. Typography

**Display / Body / Label Font:** Inter (system-ui, sans-serif fallback)

**Character:** A single sans-serif family across all type roles. Inter at different weights creates the full hierarchy; no secondary face is needed. The scale is compact (1.125–1.25 step ratio), appropriate for a dense product UI where many type elements share a screen.

### Hierarchy
- **Display** (700 weight, 1.875rem / 30px, -0.02em tracking): Page headings — "Shopping Cart," "Browse Cards," section titles. Used once per view.
- **Headline** (600 weight, 1.5rem / 24px, -0.01em tracking): Sub-section headings, card detail hero text.
- **Title** (600 weight, 1.125rem / 18px, -0.005em tracking): Card names in detail views, section sub-headings, dialog titles.
- **Body** (400 weight, 0.875rem / 14px, 1.5 line-height): All prose, descriptions, cart item labels, helper text. Cap at 65ch for readable prose runs; data tables and dense lists may run wider.
- **Label** (500 weight, 0.75rem / 12px, 0.02em tracking): Metadata tags, badge text, form labels, muted identifiers like set codes and collector numbers.

**The Single Family Rule.** Inter is the only font in use. Do not introduce a display face, a mono face for data, or a serif for any reason. Weight contrast within Inter is sufficient for the full hierarchy this product needs.

## 4. Elevation

This system is **tonal-layer flat**. No ambient shadows. Depth is expressed through surface color stepping: `void` → `surface-raised` → `surface-muted` as elements sit higher in the z-order. The visual hierarchy is: body background at void, card surfaces at void (flush), popover/dropdown panels at raised-surface.

**The No-Shadow Rule.** Drop shadows are prohibited on cards, buttons, and popover panels. The sole exception is the `group-hover:shadow-lg` on card items in the catalog grid — a subtle lift on hover to confirm interactivity. That single instance is intentional; it does not extend to other components.

### Named Elevation Tiers
- **Floor** (`#09090b`): Body background. Nothing sits below this.
- **Content** (`#09090b`): Card components are flush with the floor by default; they gain definition through a `1px border` in `border` color.
- **Floating** (`#18181b`): Popovers, dropdown menus, dialogs. One tonal step above content.
- **Overlay** (`rgba(0,0,0,0.6)`): Modal/dialog scrim. Full-page dimming layer.

## 5. Components

### Buttons

Buttons are direct and tight. No rounded excess; medium radius keeps them structured.

- **Shape:** Gently rounded (8px radius). Not pill-shaped; not square.
- **Primary:** Near-white background (`#fafafa`), near-black text (`#09090b`), 8px×16px padding. The strongest affordance on any surface.
- **Hover / Focus:** Background steps to `#e4e4e7` (one shade warmer than white). Focus ring uses the ring token (`:focus-visible` outline). No shadow added.
- **Outline:** Transparent background, `1px border` in `border` color, ink foreground. Used for secondary actions and quantity controls.
- **Ghost:** Transparent background, ink foreground, no border. Used for tertiary actions (Clear Cart, Close dialog), theme toggle, dismiss buttons.
- **Destructive:** `destructive` background, white text. Used only for irreversible actions (clear cart confirm).
- **Size/Icon variants:** `h-7 w-7` for compact quantity steppers; `h-8 w-8` for standard icon buttons; `h-10 w-10` for nav icon buttons.

### Cards / Containers

The Card component is the primary content container across the catalog, cart, and order views.

- **Corner Style:** Gently rounded (8px). Matches the button radius for visual cohesion.
- **Background:** Flush with void (`#09090b`). Cards are defined by their `1px border` in `border` color, not by background contrast.
- **Shadow Strategy:** No shadow at rest. `shadow-lg` appears on catalog card hover only (`.card-hover`).
- **Border:** `1px solid #27272a` — present on all card containers.
- **Internal Padding:** `p-3` (12px) for catalog card content; `p-4` (16px) for cart items and order summaries.

### Badges / Chips

Compact metadata labels. Used for finish types (Normal, Holo, Foil), stock status, and set codes.

- **Default:** `surface-muted` background, `ink` text, pill-shaped (full border-radius), 2px×8px padding, label-size type.
- **Destructive:** `destructive` red, white text — Out of Stock.
- **Outline:** Transparent background, border stroke — used for set codes in the cart (monospaced, slightly distinct).
- **Finish Variants:** Normal uses default neutral; Foil uses a shimmer-adjacent gold-tinted variant; Holo uses a blue-tinted variant. These are the only color-differentiated badges in the system.

### Inputs / Fields

Standard shadcn-svelte input with custom override for quantity steppers.

- **Style:** Transparent background, `1px border` stroke in `border` color, 8px radius. No fill on default state.
- **Focus:** Border shifts to `ring` color (`#3f3f46` / dark ring); focus-visible outline.
- **Quantity stepper:** Compact inputs with `h-7` height, no spin arrows, joined to `−`/`+` ghost buttons with shared border to form a single compound control.
- **Error / Disabled:** Disabled inputs get `opacity-50` and `cursor-not-allowed`. Validation errors shown via toast (sonner) rather than inline field states.

### Navigation (Header)

A sticky top-bar that stays minimal. 64px height, backdrop blur for depth over content.

- **Background:** `bg-background/95` with `backdrop-blur` — the void with 95% opacity, creating a readable but translucent bar.
- **Brand mark:** Logo favicon + "Group Buy" in 700 weight. No additional chrome.
- **Nav links:** 14px, 500 weight, `hover:text-primary` (steps from muted-ink to ink on hover). No underlines at rest.
- **Cards sub-menu:** Pure CSS hover dropdown, 8px radius, `bg-popover` (raised-surface), `shadow-lg`, 150ms opacity+visibility transition.
- **Right-side actions:** Theme toggle (ghost icon), cart badge (primary-colored count pill), avatar/sign-in.
- **Mobile:** Hamburger dropdown menu; same pattern as desktop sub-menus.

### Group Buy Banner (Signature Component)

A full-width status banner above the header, dismissible. Three states:

- **Open:** `bg-green-600` / `#16a34a` — the only moment a semantic color saturates a full surface.
- **Scheduled:** `bg-blue-600` — informational.
- **Closed:** `bg-amber-600` — warning state.

All three use white text and a ghost dismiss button. These banners are the only place in the UI where a non-neutral color carries an entire surface.

### Finish Segment Control (Signature Component)

When a card has multiple finish variants (Normal/Holo/Foil), the card item shows a segmented control in place of a single badge:

- Active segment: `bg-primary text-primary-foreground` (white fill, dark text)
- Inactive segment: `bg-muted/50 hover:bg-muted text-muted-foreground`
- Out-of-stock segment: `opacity-50 cursor-not-allowed line-through`
- All segments share a single `1px border` container with `rounded-md` and `overflow-hidden`.

## 6. Do's and Don'ts

### Do:
- **Do** keep the background at `#09090b` (void) across all content surfaces. Dark is the identity, not a theme variant.
- **Do** use Inter at weight 600–700 for headings and 400–500 for body and labels. Weight is the hierarchy; color is not.
- **Do** define card components with a `1px border` in `#27272a`. Cards derive identity from their border, not a background fill or shadow.
- **Do** use the primary (`#fafafa`) only on the single most-important action on any given screen and for currently-selected states. Its scarcity is functional.
- **Do** use semantic colors (green/red/amber) exclusively for status signals: stock availability, group-buy state, destructive confirmations.
- **Do** restrict MTG color identities (`mtg-*` palette) to card-attribute badges only. They are game vocabulary, not interface vocabulary.
- **Do** keep button radii at 8px across all variants. Consistency of shape is the system's earned familiarity.
- **Do** use `text-muted-foreground` (`#a1a1aa`) for secondary metadata and verify it clears 4.5:1 against the void background.

### Don't:
- **Don't** introduce a generic TCGO-style storefront aesthetic (TCGPlayer/Card Kingdom optimism, light-mode marketplace chrome, "shop" branding conventions). This is a community tool, not a licensed storefront.
- **Don't** use cheap proxy-site patterns: watermark overlays on non-promotional UI, discount-badge decoration, Comic Sans or novelty fonts at any scale.
- **Don't** use SaaS dashboard chrome: feature-announcement gradients, marketing typography in UI labels, hero-metric templates (big number + small label + gradient accent).
- **Don't** add `box-shadow` to cards, buttons, or input fields at rest. The one hover shadow on catalog cards is intentional and isolated; don't extend it.
- **Don't** use `border-radius` greater than 8px on cards or input fields. 8px is the system ceiling; the full-pill shape is reserved for badges and chips only.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or callout boxes.
- **Don't** apply `background-clip: text` gradient text effects. Color emphasis uses weight (600–700), not gradient decoration.
- **Don't** use the MTG color identity values (`#C9A964`, `#D3202A`, `#0E68AB`, `#00733E`) in navigation, buttons, or any interface chrome. They exist for card-attribute display only.
- **Don't** add motion to page-load sequences, background elements, or non-interactive layout. State transitions (hover, select, toast) use 150–200ms ease-out. No choreographed entrances.
- **Don't** render identical icon-grid card layouts for non-card content. The MTG card grid (`aspect-[2.5/3.5]`) is specific to the catalog; other content sections use list or table layouts.
