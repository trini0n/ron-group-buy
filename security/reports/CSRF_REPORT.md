# CSRF Security Report

## Status: PASS

## Findings

### Authentication Mechanism

This application uses **Supabase Auth with session cookies** via `@supabase/ssr`. The `hooks.server.ts` uses `createServerClient` which relies on Supabase's built-in cookie handling.

### SameSite Cookie Configuration

The Supabase SSR library sets session cookies with `SameSite=Lax` by default, which provides CSRF protection for all state-changing endpoints. Manually-set cookies in the codebase also use `sameSite: 'lax'`:

```typescript
// src/routes/api/cart/+server.ts:104
sameSite: 'lax',
```

This is the correct setting:
- `SameSite=Lax` blocks cross-site POST, PUT, PATCH, DELETE requests from carrying the session cookie
- It allows GET requests from cross-site navigations (needed for OAuth redirects)

### `hooks.server.ts` Cookie Handling

```typescript
set: (key, value, options) => {
  event.cookies.set(key, value, { ...options, path: '/' })
}
```

The options spread includes whatever Supabase SSR library sends, which includes `SameSite=Lax` and `HttpOnly=true` by default.

### CSRF Token — Not Needed

With `SameSite=Lax` cookies, an explicit CSRF token implementation is not required. Cross-site form POSTs cannot carry the session cookie, making CSRF attacks impossible.

### No Forms Using `method="POST"` Without AJAX

The application uses SvelteKit's server actions and fetch-based API calls, not traditional form submissions. This further reduces CSRF surface area.

### Guest Cart Cookie
```typescript
cookies.set('guest_cart_id', guestId, {
  path: '/',
  httpOnly: true,   // ✅
  secure: true,     // ✅
  sameSite: 'lax',  // ✅
  maxAge: 60 * 60 * 24 * 90
})
```

Well-configured.

## What's at Risk

Nothing — `SameSite=Lax` cookie configuration prevents CSRF attacks.

## What's Already Secure

- Supabase SSR uses `SameSite=Lax` by default for session cookies
- Guest cart cookie is properly configured with `httpOnly`, `secure`, and `sameSite: 'lax'`
- API uses JSON bodies (not form-encoded), which cross-site attackers cannot send with the session cookie
- No traditional form submissions without AJAX

## Recommendations

1. No action required.
2. Consider adding `SameSite=Strict` to the guest cart cookie for extra protection (would prevent cart from being used in cross-site navigations, which may or may not matter for your UX).
