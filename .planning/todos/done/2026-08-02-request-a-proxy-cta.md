---
created: 2026-08-02T18:43
title: Add "Request a Proxy" CTA to header and Deck Import not-found cards
area: ui
files:
  - src/lib/components/layout/Header.svelte
  - src/routes/deck-import/+page.svelte
---

## Problem

When users can't find high-value cards in Ron's inventory, there's no clear path to request them. Users may leave the site without knowing they can submit proxy requests.

## Solution

Add a "Request a Proxy" CTA in two locations:

**1. Site Header**: A persistent CTA button/link in the header navigation that links to https://requestaproxy.up.railway.app/

**2. Deck Import — Not Found Cards**: When the deck import results show cards not found in inventory, display a contextual message near those cards.

### Messaging

Keep it succinct. Communicate:

> Can't find a card? Request it by joining Ron's Discord Server ([discord.gg/aYxfbVDHMv](https://discord.gg/aYxfbVDHMv)) or through the [Request a Proxy](https://requestaproxy.up.railway.app/) site.

### Links

- **Request a Proxy site**: https://requestaproxy.up.railway.app/
- **Discord invite**: https://discord.gg/aYxfbVDHMv
