# Security Audit Summary

**Project**: BootlegMTG Group Buy  
**Audit Date**: 2026-06-26  
**Checklist**: AI-CHECKLIST.md (17 categories)  
**Auditor**: Antigravity AI Security Audit

---

## Executive Summary

The application is **well-secured overall**. The authentication architecture (Supabase SSR with `auth.getUser()`), database access controls (RLS on every table), and use of Zod input validation are solid foundations. Three fixes were applied automatically. One critical operational action is required (rotate the Discord bot token).

---

## Results Table

| # | Category | Status | Severity | Auto-Fixed |
|---|----------|--------|----------|------------|
| 1 | SECRETS_EXPOSURE | ⚠️ OPERATIONAL | HIGH | ❌ (manual action required) |
| 2 | DATABASE_ACCESS | ✅ PASS | — | — |
| 3 | AUTH_MIDDLEWARE | ✅ PASS (minor) | LOW | ✅ (401 vs 403 fix) |
| 4 | ACCESS_CONTROL | ✅ PASS | — | — |
| 5 | FRONTEND_SECRETS | ✅ PASS | — | — |
| 6 | SSRF | ✅ PASS | — | — |
| 7 | CSRF | ✅ PASS | — | — |
| 8 | XSS | ✅ PASS | — | — |
| 9 | SQL_INJECTION | ✅ PASS | — | — |
| 10 | INPUT_VALIDATION | ✅ PASS (1 gap fixed) | LOW | ✅ (Zod schema on address PATCH) |
| 11 | RATE_LIMITING | ✅ PASS | — | — |
| 12 | SECURITY_HEADERS | ❌ FAIL → FIXED | MEDIUM | ✅ (all 6 headers added) |
| 13 | CORS | ✅ PASS | — | — |
| 14 | FILE_UPLOADS | ✅ PASS (N/A) | — | — |
| 15 | PAYMENTS | ✅ PASS (N/A) | — | — |
| 16 | ERROR_HANDLING | ⚠️ PARTIAL → FIXED | MEDIUM | ✅ (3 user-facing routes fixed) |
| 17 | DEPENDENCIES | ❌ FAIL | HIGH (dev only) | ❌ (needs npm update) |

---

## Required Manual Actions

### 🔴 CRITICAL — Do Immediately

1. **Rotate Discord Bot Token**
   - Go to Discord Developer Portal → Your App → Bot → Reset Token
   - Update new token in Vercel Dashboard → Environment Variables → `DISCORD_BOT_TOKEN`
   - Verify bot still works after rotation

2. **Scan git history for accidental `.env` commits**
   ```bash
   git log --all --full-history -- .env
   git log --all --full-history -- "*.env"
   ```
   If any commits found, the tokens in those commits are permanently compromised — rotate all of them.

---

### 🟡 HIGH — Do This Week

3. **Update vulnerable dev dependencies**
   ```bash
   npm install --save-dev vitest@latest @vitest/coverage-v8@latest
   npm install --save-dev vite@latest
   npm run test:unit  # verify tests still pass
   npm run build      # verify build still works
   ```

4. **Verify Supabase Auth rate limits**
   - Supabase Dashboard → Authentication → Rate Limits
   - Ensure email/OTP limits are configured appropriately

---

### 🟢 LOW — Do When Convenient

5. **Test security headers in browser**
   - Open DevTools → Network → check Response Headers
   - Confirm CSP doesn't block any legitimate app resources
   - Fix any CSP violations that appear

6. **Verify Supabase CORS allowlist**
   - Supabase Dashboard → Settings → API → CORS
   - Ensure only your production domain and localhost are listed

7. **Run `npm audit --production`** to confirm no production vulnerabilities

---

## Code Changes Applied

| File | Change |
|------|--------|
| `src/hooks.server.ts` | Added 6 security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) |
| `src/routes/api/admin/orders/bulk-status/+server.ts` | Return 401 (not 403) for unauthenticated requests |
| `src/routes/api/admin/orders/bulk-tracking/+server.ts` | Return 401 (not 403) for unauthenticated requests |
| `src/routes/api/profile/addresses/[id]/+server.ts` | Added Zod schema for PATCH (whitelist allowed fields); generic error messages |
| `src/routes/api/orders/[id]/load-to-cart/+server.ts` | Generic error message (remove internal err.message exposure) |

---

## What's Strong ✅

- **RLS on every table** — all 22 database tables have Row Level Security enabled
- **`auth.getUser()` in hooks** — validates session against Supabase server on every request
- **Parameterized queries** — 100% Supabase client library, zero raw SQL
- **Zod validation** — 16 API routes validate input with Zod schemas
- **No XSS vectors** — zero `{@html}` usage in any Svelte component
- **No SSRF** — all URL fetches use hardcoded domains or env-var URLs
- **SameSite=Lax cookies** — CSRF attacks blocked at the browser layer
- **Server-only secrets** — `$env/static/private` correctly used; secrets never in client code

---

## Reports and Plans

All detailed findings are in `security/reports/` and `security/plans/`:

| Category | Report | Plan |
|----------|--------|------|
| SECRETS_EXPOSURE | [Report](reports/SECRETS_EXPOSURE_REPORT.md) | [Plan](plans/SECRETS_EXPOSURE_PLAN.md) |
| DATABASE_ACCESS | [Report](reports/DATABASE_ACCESS_REPORT.md) | [Plan](plans/DATABASE_ACCESS_PLAN.md) |
| AUTH_MIDDLEWARE | [Report](reports/AUTH_MIDDLEWARE_REPORT.md) | [Plan](plans/AUTH_MIDDLEWARE_PLAN.md) |
| ACCESS_CONTROL | [Report](reports/ACCESS_CONTROL_REPORT.md) | [Plan](plans/ACCESS_CONTROL_PLAN.md) |
| FRONTEND_SECRETS | [Report](reports/FRONTEND_SECRETS_REPORT.md) | [Plan](plans/FRONTEND_SECRETS_PLAN.md) |
| SSRF | [Report](reports/SSRF_REPORT.md) | [Plan](plans/SSRF_PLAN.md) |
| CSRF | [Report](reports/CSRF_REPORT.md) | [Plan](plans/CSRF_PLAN.md) |
| XSS | [Report](reports/XSS_REPORT.md) | [Plan](plans/XSS_PLAN.md) |
| SQL_INJECTION | [Report](reports/SQL_INJECTION_REPORT.md) | [Plan](plans/SQL_INJECTION_PLAN.md) |
| INPUT_VALIDATION | [Report](reports/INPUT_VALIDATION_REPORT.md) | [Plan](plans/INPUT_VALIDATION_PLAN.md) |
| RATE_LIMITING | [Report](reports/RATE_LIMITING_REPORT.md) | [Plan](plans/RATE_LIMITING_PLAN.md) |
| SECURITY_HEADERS | [Report](reports/SECURITY_HEADERS_REPORT.md) | [Plan](plans/SECURITY_HEADERS_PLAN.md) |
| CORS | [Report](reports/CORS_REPORT.md) | [Plan](plans/CORS_PLAN.md) |
| FILE_UPLOADS | [Report](reports/FILE_UPLOADS_REPORT.md) | [Plan](plans/FILE_UPLOADS_PLAN.md) |
| PAYMENTS | [Report](reports/PAYMENTS_REPORT.md) | [Plan](plans/PAYMENTS_PLAN.md) |
| ERROR_HANDLING | [Report](reports/ERROR_HANDLING_REPORT.md) | [Plan](plans/ERROR_HANDLING_PLAN.md) |
| DEPENDENCIES | [Report](reports/DEPENDENCIES_REPORT.md) | [Plan](plans/DEPENDENCIES_PLAN.md) |
