# ACCESS_CONTROL Fix Plan

## Status: PASS — No changes required

## Verification Goals

- [x] Every route with a resource ID parameter checks ownership (CONFIRMED)
- [x] Address PATCH/DELETE enforces `user_id` in query (CONFIRMED)
- [x] Order cancel/merge enforces `order.user_id !== locals.user.id` (CONFIRMED)
- [x] Order creation enforces address ownership with `.eq('user_id', locals.user.id)` (CONFIRMED)
- [x] Failing the ownership check returns 403 or no data (CONFIRMED)
- [x] Auth and ownership are separate checks (CONFIRMED — auth checked first, then ownership)
- [x] RLS provides defense-in-depth for all user tables (CONFIRMED)

## Manual Verification (for the human)

Test cross-user access:

1. Log in as User A. Note an address ID from User A.
2. Log in as User B.
3. Attempt to PATCH `/api/profile/addresses/{user-a-address-id}` with User B's session.
4. Expected: empty response (null) or 404 — not a success.

Test order ownership:
1. Log in as User A. Find User A's order ID.
2. Log in as User B.
3. POST to `/api/orders/{user-a-order-id}/pending` with User B's session.
4. Expected: 403 Forbidden.
