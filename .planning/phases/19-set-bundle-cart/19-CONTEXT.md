---
phase: 19
created: 2026-06-14
status: decisions-locked
---

# Phase 19 Context — Set Bundle Cart + Checkout

## Objective

Allow users to add a full vendor-curated set as a single bundle line item to the cart at the set's price. Requires parallel data structures alongside the existing card cart system.

## Locked Decisions

### D1 — Cart Data Model
**Decision:** Separate `cart_bundles` table — mirrors `cart_items` structure but references `sets` instead of `cards`.

```
cart_bundles
  id          UUID PK
  cart_id     FK → carts
  set_code    FK → sets
  quantity    INTEGER DEFAULT 1
  created_at  TIMESTAMPTZ
  updated_at  TIMESTAMPTZ
  UNIQUE(cart_id, set_code)  -- one row per set per cart (quantity handles multiples)
```

**Rationale:** Keeps bundle and card line items fully separate — no discriminator column hacks, no nullable FKs, clean schema.

### D2 — Quantity
**Decision:** Quantity-based. Same set can be added multiple times via a `quantity` field. Upsert increments quantity, remove decrements/deletes.

### D3 — Stock Checking
**Decision:** Allow checkout regardless of individual card stock. Bundles are managed as a unit — stock is the vendor's concern, not enforced per-card at checkout.

### D4 — Cart UI
**Decision:** Bundles displayed as a **distinct section above individual cards** — clearly separated with a section heading (e.g. "Sets" / "Individual Cards").

### D5 — Price Snapshotting
**Decision:** Always use **live `sets.price`** at checkout — no snapshot into cart_bundles. If price changes between add and checkout, user pays the current price. (Cart will show the live price.)

### D6 — Order Storage
**Decision:** Separate `order_bundle_items` table — mirrors `order_items` but for bundles.

```
order_bundle_items
  id                UUID PK
  order_id          FK → orders
  set_code          FK → sets (or TEXT if set could be deleted)
  set_name          TEXT  -- snapshot at checkout (in case set is renamed/deleted)
  quantity          INTEGER
  price_at_purchase NUMERIC(10,2)  -- snapshot of sets.price at checkout time
  created_at        TIMESTAMPTZ
```

Note: `price_at_purchase` IS snapshotted in orders (even though cart is live price). This is the standard e-commerce pattern — cart is live, order is permanent record.

## Scope Boundaries

**In scope:**
- `cart_bundles` table + RLS
- `order_bundle_items` table + RLS
- Cart service: add bundle, remove bundle, update quantity, fetch bundles with cart
- Cart store: bundle state management alongside card items
- Cart UI: bundles section above cards
- `/sets` listing: "Add to Cart" button per set
- Checkout: process bundle items → insert into `order_bundle_items`
- Order history: display bundle items in order detail

**Out of scope:**
- Per-card stock enforcement on bundle checkout (D3)
- Bundle discounts or promo pricing
- Mixing a bundle with individual cards from the same set (no deduplication logic)
- Bundle gifting or split orders

## Implementation Notes

### Cart Merge (existing feature)
The existing cart merge modal handles merging guest cart → user cart on login. This will need to handle `cart_bundles` rows too — merge strategy: upsert on `set_code`, increment quantity.

### Cart Item Count (header badge)
Currently shows count of `cart_items`. Should add bundle count: `cartItems.length + bundles.reduce((sum, b) => sum + b.quantity, 0)`.

### Cart Total
Bundle total = `sum(bundle.quantity * live_sets_price)` fetched fresh.

## Plan Structure (3 plans)

- **19-01** — DB migration (`cart_bundles`, `order_bundle_items`) + update cart service + cart store
- **19-02** — Cart UI (bundles section) + "Add to Cart" on `/sets` listing
- **19-03** — Checkout + order system: process bundles → `order_bundle_items`, order history display
