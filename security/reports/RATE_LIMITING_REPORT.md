# RATE_LIMITING Security Report

## Status: PASS (with documented limitations)

## Findings

### Rate Limiter Implementation

The application uses an in-memory `lru-cache` based rate limiter:

```typescript
// src/lib/server/rate-limiter.ts
// Sliding-window per-IP counter using LRU cache
export function createRateLimiter({ limit, windowMs, maxIps = 5000 })
```

**Key limitation (documented)**: This is per-process/per-instance. On Vercel serverless, each cold-start spawns an independent instance with its own counter. A determined attacker could hit multiple instances and exceed the limit.

The code itself acknowledges this:
```
NOTE: This is per-process (in-memory). On Vercel, each serverless instance
has its own cache. This protects against single-client abuse per instance
but does not coordinate across cold-start instances.
```

### Endpoints with Rate Limiting

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|-------|
| `/api/import/search` | 30 req | 60s | Card database search — prevents cost amplification |
| `/api/import/deck` | (same limiter) | 60s | Deck import — proxies external APIs |

### Endpoints WITHOUT Rate Limiting

| Endpoint | Risk | Notes |
|----------|------|-------|
| `/api/cart` POST | LOW | Requires card IDs to exist in DB; RLS limits scope |
| `/api/orders` POST | MEDIUM | Order creation — could spam order records |
| `/api/profile/password` | MEDIUM | Password reset — no rate limiting |
| Auth endpoints (Supabase) | HANDLED | Supabase Auth has built-in rate limiting on login/signup/reset |

### Auth Rate Limiting — Supabase Handled

The login, signup, and password reset flows use Supabase Auth directly. Supabase has built-in rate limiting on these flows (configurable in Dashboard → Auth settings). The app doesn't need to implement this itself.

### X-Forwarded-For Trust

```typescript
const forwarded = request.headers.get('x-forwarded-for')
return forwarded.split(',')[0]?.trim() ?? 'unknown'
```

On Vercel, the `x-forwarded-for` header is set by Vercel's infrastructure before reaching the app, making IP spoofing impractical in production. For local development, the IP will be `unknown` (harmless).

## What's at Risk

- **Password reset (user-facing)**: No application-level rate limiting. Relies on Supabase Auth's built-in limits.
- **Order creation**: No rate limiting. A malicious user could spam orders rapidly (though they'd need to be authenticated and have items in cart).
- **Distributed attacks**: In-memory rate limiting doesn't coordinate across Vercel instances.

## Recommendations

1. **MEDIUM**: Verify Supabase Auth rate limits are configured in Supabase Dashboard (30 requests/hour is the default for email auth).
2. **LOW**: Add rate limiting to `POST /api/orders` (e.g., 5 orders/minute per user ID, not just IP).
3. **INFO**: For true distributed rate limiting, consider Vercel KV + Upstash as a drop-in replacement.
