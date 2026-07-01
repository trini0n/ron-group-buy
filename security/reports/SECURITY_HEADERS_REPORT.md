# SECURITY_HEADERS Security Report

## Status: FAIL — No security headers configured

## Findings

### Missing Headers

None of the following security headers are currently set on any response:

| Header | Status | Risk |
|--------|--------|------|
| `Content-Security-Policy` | ❌ Missing | Medium — XSS defense-in-depth |
| `Strict-Transport-Security` | ❌ Missing | Medium — HTTPS enforcement |
| `X-Frame-Options` | ❌ Missing | Medium — Clickjacking prevention |
| `X-Content-Type-Options` | ❌ Missing | Low — MIME sniffing |
| `Referrer-Policy` | ❌ Missing | Low — Referrer leakage |
| `Permissions-Policy` | ❌ Missing | Low — Browser feature control |

### `hooks.server.ts` Review

The `hooks.server.ts` only handles Supabase session setup. No `setHeaders()` or response header manipulation. The `resolve(event)` call returns unmodified response headers.

### Vercel Headers Config

The `.vercel/` directory does not contain a `vercel.json` with header rules. No header configuration found.

### Impact

- **No CSP**: While there's no current XSS vector (Svelte escapes by default), a CSP would prevent XSS from unknown vectors (e.g., browser extensions injecting scripts, third-party libs).
- **No HSTS**: Browsers will use HTTPS on the first visit but can be MITM'd by a network attacker before the first redirect. HSTS fixes this (and is mandatory for `preload` list).
- **No X-Frame-Options**: The app could be embedded in an `<iframe>` by a malicious site for clickjacking attacks on authenticated actions.
- **No X-Content-Type-Options**: Browsers could MIME-sniff responses and execute non-script files as scripts.

## What's Already Secure

- Vercel deploys over HTTPS automatically (so MITM on subsequent visits is unlikely)
- No `{@html}` usage means CSP violation risk is low but non-zero (third-party scripts)
- The app doesn't serve executable files that could be MIME-sniffed

## Fix

Add security headers in `hooks.server.ts` using SvelteKit's `setHeaders` in the `resolve` transform. See SECURITY_HEADERS_PLAN.md.

## Recommendations

1. **MEDIUM**: Add security headers to `hooks.server.ts` — 10 lines of code.
2. **LOW**: Tighten CSP after monitoring in report-only mode.
