# RATE_LIMITING Fix Plan

## Status: PASS — Optional improvements

## Verification Goals

- [x] Search and deck import endpoints have rate limiting (CONFIRMED — 30 req/60s)
- [x] Rate limiter is documented with its limitations (CONFIRMED — in-code comment)
- [x] Auth endpoints use Supabase's built-in rate limiting (CONFIRMED — not bypassed)
- [ ] Supabase Auth rate limits verified in Dashboard (manual verification required)
- [ ] Order creation has per-user rate limiting (optional improvement)

## Optional Improvements

### Add rate limit to order creation (OPTIONAL/LOW)

```typescript
// src/routes/api/orders/+server.ts
const orderLimiter = createRateLimiter({ limit: 5, windowMs: 60_000 }) // 5 orders/min

export const POST: RequestHandler = async ({ request, locals }) => {
  // Rate limit by user ID (more reliable than IP for authenticated users)
  const { limited } = orderLimiter(locals.user?.id ?? getClientIp(request))
  if (limited) {
    throw error(429, 'Too many orders submitted. Please wait before trying again.')
  }
  // ... rest of handler
}
```

### Upgrade to distributed rate limiting (OPTIONAL/LOW)

For production scale:
```bash
npm install @upstash/ratelimit @upstash/redis
```

Then replace `createRateLimiter` with Upstash's Redis-backed rate limiter for coordination across Vercel instances.

## Manual Verification (for the human)

1. Verify Supabase Auth rate limits in: Supabase Dashboard → Authentication → Rate Limits
2. Default is 30 OTP/email emails per hour. Ensure this is configured appropriately.
3. Test rate limiting on import search: send 31 requests in 60 seconds and confirm 429 response.
