# DATABASE_ACCESS Security Report

## Status: PASS

## Findings

### Tables with RLS Enabled

All tables have Row Level Security enabled:

| Table | RLS | Policies |
|-------|-----|----------|
| `users` | ✅ | SELECT/UPDATE scoped to `auth.uid() = id`; admins can view/update all |
| `addresses` | ✅ | Full CRUD scoped to `user_id = (SELECT auth.uid())` |
| `carts` | ✅ | Full CRUD scoped to `user_id = (SELECT auth.uid())` |
| `cart_items` | ✅ | Full CRUD via cart ownership |
| `cart_bundles` | ✅ | Full CRUD via cart ownership (migrated to explicit per-op policies in `20260624000000_security_hardening.sql`) |
| `orders` | ✅ | SELECT/INSERT/UPDATE scoped to user; admins can view/update all |
| `order_items` | ✅ | SELECT/INSERT via order ownership |
| `order_bundle_items` | ✅ | SELECT via order ownership; admins can view all |
| `order_status_history` | ✅ | SELECT via order ownership or admin |
| `checkout_sessions` | ✅ | SELECT/INSERT/UPDATE scoped to user |
| `cart_merge_history` | ✅ | SELECT/INSERT scoped to user |
| `notification_preferences` | ✅ | SELECT/INSERT/UPDATE scoped to user |
| `notifications` | ✅ | SELECT scoped to user |
| `notification_templates` | ✅ | SELECT for all authenticated users |
| `admins` | ✅ | SELECT only for admins (via `is_admin()`) |
| `cards` | ✅ | SELECT for everyone (catalog — intentionally public) |
| `group_buy_config` | ✅ | SELECT for everyone (config — intentionally public) |
| `card_type_pricing` | ✅ | SELECT for everyone (pricing — intentionally public) |
| `sets` | ✅ | SELECT for everyone (set catalog — intentionally public) |
| `set_cards` | ✅ | SELECT for everyone (intentionally public) |
| `gphoto_url_cache` | ✅ | `USING (false)` — service-role-only (correct) |
| `sync_duplicate_alerts` | ✅ | Admin-only SELECT/UPDATE (fixed in `20260624000000_security_hardening.sql`) |

### USING (true) Policies — Intentionally Public

Five policies use `USING (true)` for SELECT only:
1. `cards` — public card catalog (appropriate)
2. `group_buy_config` — public group buy status (appropriate)
3. `card_type_pricing` — public pricing table (appropriate)
4. `sets` — public set catalog (appropriate)
5. `set_cards` — public set card listings (appropriate)

All are SELECT-only. No INSERT/UPDATE/DELETE uses `USING (true)`.

### `is_admin()` Function

Defined as `SECURITY DEFINER` with `SET search_path = public, pg_temp` (pinned in `20260624000000_security_hardening.sql`), preventing search-path injection attacks.

### `gphoto_url_cache` Table

Uses `USING (false)` RLS policy — correctly blocks all direct client access, while the service role (adminClient) bypasses RLS as designed.

### Previous Vulnerabilities (Fixed)

- **20260624**: `sync_duplicate_alerts` was previously readable by all authenticated users — fixed to admin-only.
- **20260624**: `cart_bundles` single FOR ALL policy replaced with explicit per-operation policies.
- **20260624**: SECURITY DEFINER functions now have `SET search_path` pinned.
- **20260211**: `gphoto_url_cache` table had RLS disabled — fixed.

## What's at Risk

None currently identified. The `USING (true)` policies are on read-only public catalogs which are intentionally public data.

## What's Already Secure

- Every table has RLS enabled
- All user-data tables scope to `(SELECT auth.uid())` (with InitPlan caching optimization from migration 20260109)
- Admin tables have proper `is_admin()` function checks
- Service-role-only tables use `USING (false)` correctly
- Public catalog tables use `USING (true)` for SELECT only (appropriate)
- SECURITY DEFINER functions have `search_path` pinned

## Recommendations

1. No immediate action required.
2. When adding new tables, remember to:
   - Enable RLS immediately: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY`
   - Use the `(SELECT auth.uid())` pattern (not bare `auth.uid()`) for performance
   - Add both USING and WITH CHECK clauses for DML policies
