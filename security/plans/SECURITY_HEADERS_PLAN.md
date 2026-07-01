# SECURITY_HEADERS Fix Plan

## Status: FIXED — Headers added to hooks.server.ts

## Changes Made

- `src/hooks.server.ts` — Added 6 security headers to every response:
  - `Content-Security-Policy` — restricts resource loading
  - `X-Frame-Options: DENY` — prevents clickjacking
  - `X-Content-Type-Options: nosniff` — prevents MIME sniffing
  - `Referrer-Policy: strict-origin-when-cross-origin` — controls referrer info
  - `Strict-Transport-Security` — enforces HTTPS for 1 year + subdomains
  - `Permissions-Policy` — blocks unused browser features

## CSP Directives

```
default-src 'self';
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com;
frame-ancestors 'none';
object-src 'none';
script-src 'self'
```

`'unsafe-inline'` is included in `style-src` to support SvelteKit's inline styles. This is acceptable since XSS is already mitigated by Svelte's auto-escaping and no `{@html}` usage.

## Verification Goals

- [x] CSP header present on all responses (IMPLEMENTED)
- [x] X-Frame-Options: DENY present (IMPLEMENTED)
- [x] X-Content-Type-Options: nosniff present (IMPLEMENTED)
- [x] Referrer-Policy present (IMPLEMENTED)
- [x] Strict-Transport-Security present (IMPLEMENTED)
- [ ] CSP violation monitoring enabled (optional — add report-uri)
- [ ] Test in browser that no CSP violations appear in console

## Manual Verification (for the human)

1. Run the dev server: `npm run dev`
2. Open DevTools → Network → pick any request
3. Check Response Headers — you should see all 6 security headers
4. Open DevTools → Console — there should be NO CSP violation errors for normal page usage
5. If you see CSP violations for legitimate resources, add those domains to the CSP

## Known Limitations

- `'unsafe-inline'` in `style-src` is needed for SvelteKit inline styles
- If you use any third-party JavaScript (analytics, chat widgets), add their domains to `script-src`
- Google Images used for card images should come from Supabase storage (already in `img-src`)

## CSP Refinement

After testing, you can tighten the CSP:
- Remove `'unsafe-inline'` from `style-src` if you adopt CSS modules or move all styles to files
- Add a `report-uri` endpoint to monitor violations in production before blocking
