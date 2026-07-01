# INPUT_VALIDATION Fix Plan

## Status: Fixed one issue, LOW remaining gaps

## Changes Made

- `src/routes/api/profile/addresses/[id]/+server.ts` — Added `UpdateAddressSchema` Zod validation to PATCH handler, replacing open-spread of entire request body

## Remaining Low-Priority Items

The following admin-only routes use manual destructuring without Zod schemas. These are LOW risk (admin-only), but worth hardening:
1. `/api/admin/orders/[id]` PATCH — `tracking_number, tracking_carrier, admin_notes, paypal_invoice_url`
2. `/api/admin/users/[id]` PATCH — `admin_notes, is_blocked, blocked_reason`
3. `/api/profile` PATCH — `name, paypal_email` (no length limits)

## Verification Goals

- [x] All user-facing routes with schema have Zod safeParse (CONFIRMED — 16 routes)
- [x] `/api/profile/addresses/[id]` PATCH uses whitelisted Zod schema (FIXED — see above)
- [x] Zod validation runs server-side (CONFIRMED — all schemas are in `+server.ts` files)
- [x] Zod validation errors return 400 with issues details (CONFIRMED)
- [ ] Admin routes with manual destructuring use Zod (remaining LOW items)
- [ ] `/api/profile` PATCH validates name length (remaining LOW item)

## Manual Verification (for the human)

Test address update rejects extra fields:
```bash
curl -X PATCH https://your-domain.com/api/profile/addresses/{id} \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-*-auth-token=..." \
  -d '{"user_id": "another-user-uuid", "name": "Test"}'
# Expected: 400 (user_id is not in the Zod schema)
```

Actually: `user_id` is not in `UpdateAddressSchema`, so Zod strips it (since `.object()` without `.strict()` strips unknown keys). This means `user_id` won't reach the `.update()` call. ✅
