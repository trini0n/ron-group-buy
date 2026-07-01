# AUTH_MIDDLEWARE Fix Plan

## Status: LOW concern — minor 401 vs 403 distinction on bulk admin endpoints

## Changes

- `src/routes/api/admin/orders/bulk-status/+server.ts` — Add explicit 401 for unauthenticated before 403 for non-admin
- `src/routes/api/admin/orders/bulk-tracking/+server.ts` — Same fix

## Verification Goals

- [x] Every route that returns or modifies user data has auth middleware (CONFIRMED)
- [x] Auth middleware runs before the handler, not inside it (CONFIRMED)
- [x] hooks.server.ts uses `auth.getUser()` for server-side validation (CONFIRMED)
- [ ] Unauthenticated requests to admin routes return 401 (currently returns 403 for bulk routes — needs fix)
- [x] Non-admin authenticated requests to admin routes return 403 (CONFIRMED)
- [x] Admin layout redirects unauthenticated users to login (CONFIRMED)

## Implementation

### Fix bulk-status (LOW priority)

```typescript
// src/routes/api/admin/orders/bulk-status/+server.ts
export const POST: RequestHandler = async ({ request, locals }) => {
  // Separate 401 (not logged in) from 403 (not admin)
  if (!locals.user) {
    throw error(401, 'Authentication required')
  }
  if (!(await isAdminRequest(locals))) {
    throw error(403, 'Admin access required')
  }
  // ... rest of handler
}
```

### Fix bulk-tracking (LOW priority)

Same pattern as bulk-status.

## Manual Verification (for the human)

Test that unauthenticated POST to admin bulk endpoints returns 401 (after fix):
```bash
curl -X POST https://your-domain.com/api/admin/orders/bulk-status \
  -H "Content-Type: application/json" \
  -d '{"orderIds":["test"],"status":"paid"}'
# Expected: 401 Unauthorized
```

Test that authenticated non-admin returns 403:
```bash
curl -X POST https://your-domain.com/api/admin/orders/bulk-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <user-token>" \
  -d '{"orderIds":["test"],"status":"paid"}'
# Expected: 403 Forbidden
```
