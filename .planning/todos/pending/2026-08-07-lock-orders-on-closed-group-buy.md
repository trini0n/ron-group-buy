---
created: 2026-08-07T11:26
title: Lock orders when group buy is closed — prevent merge/edit/cancel
area: orders
files: []
---

## Problem

When a Group Buy is past its closing date or set to inactive, users with a pending order can still merge that order into their cart. This effectively lets them "cancel" their pending order by accident (or intentionally circumvent the lock). The merge-to-cart, edit, and cancel actions should all be disabled once the parent group buy is closed.

## Solution

When a group buy is closed (past closing date or inactive status):

1. **Disable "Merge to Cart"**: The button/action that merges a pending order back into the user's active cart should be hidden or disabled. If the API endpoint is called directly, it should return an error explaining the group buy is closed.

2. **Disable "Edit Order"**: Users should not be able to modify quantities or items on their pending order for a closed group buy.

3. **Disable "Cancel Order"**: Users should not be able to cancel their pending order once the group buy has closed.

4. **UI feedback**: Show a clear visual indicator (badge, banner, or tooltip) on the order explaining that changes are locked because the group buy has closed.

5. **Server-side enforcement**: All restrictions must be enforced server-side, not just in the UI. The API should reject any merge/edit/cancel attempts on orders belonging to closed group buys.
