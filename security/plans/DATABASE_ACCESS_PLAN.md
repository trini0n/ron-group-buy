# DATABASE_ACCESS Fix Plan

## Status: PASS — No changes required

## Verification Goals

- [x] Every table has RLS enabled (CONFIRMED — all 22 tables have `ENABLE ROW LEVEL SECURITY`)
- [x] Every table has explicit policies scoped to `auth.uid()` (CONFIRMED — using `(SELECT auth.uid())` pattern)
- [x] No policy uses `USING (true)` without a proper condition for write operations (CONFIRMED — all `USING (true)` are SELECT-only on intentionally public tables)
- [x] SECURITY DEFINER functions have `SET search_path` pinned (CONFIRMED — fixed in `20260624000000_security_hardening.sql`)
- [ ] A curl request with just the anon key to a protected table returns empty or 403 (manual verification required)

## Manual Verification (for the human)

Test that a raw anon-key request to a protected table returns no data:

```bash
# Replace with your actual URL and anon key from .env
curl -X GET \
  "https://ritpdjwomrvkfogqanlj.supabase.co/rest/v1/orders?select=*" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

Expected: empty array `[]` (RLS blocks unauthenticated reads on `orders`)

```bash
# Also test users table
curl -X GET \
  "https://ritpdjwomrvkfogqanlj.supabase.co/rest/v1/users?select=*" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

Expected: empty array `[]`

```bash
# Public tables should return data (this is correct)
curl -X GET \
  "https://ritpdjwomrvkfogqanlj.supabase.co/rest/v1/cards?select=id,card_name&limit=1" \
  -H "apikey: <anon-key>"
```

Expected: one card row (public catalog)
