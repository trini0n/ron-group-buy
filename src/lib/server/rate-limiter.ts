/**
 * Simple IP-based sliding-window rate limiter using lru-cache.
 *
 * NOTE: This is per-process (in-memory). On Vercel, each serverless instance
 * has its own cache. This protects against single-client abuse per instance
 * but does not coordinate across cold-start instances. Sufficient for preventing
 * casual DoS amplification; distributed rate limiting would require Vercel KV.
 */
import { LRUCache } from 'lru-cache'

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimiterOptions {
  /** Maximum requests allowed per window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
  /** Maximum number of unique IPs to track */
  maxIps?: number
}

interface RateLimitResult {
  limited: boolean
  remaining: number
  resetAt: number
}

/**
 * Create a rate limiter instance for a specific endpoint.
 * Call once at module level, not per-request.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { limit, windowMs, maxIps = 5000 } = options

  const cache = new LRUCache<string, RateLimitEntry>({
    max: maxIps,
    ttl: windowMs
  })

  return function checkRateLimit(ip: string): RateLimitResult {
    const now = Date.now()
    const existing = cache.get(ip)

    if (!existing || existing.resetAt <= now) {
      const entry: RateLimitEntry = { count: 1, resetAt: now + windowMs }
      cache.set(ip, entry)
      return { limited: false, remaining: limit - 1, resetAt: entry.resetAt }
    }

    existing.count++
    cache.set(ip, existing)

    const remaining = Math.max(0, limit - existing.count)
    const limited = existing.count > limit

    return { limited, remaining, resetAt: existing.resetAt }
  }
}

/**
 * Extract the client IP from a request.
 * Prefers X-Forwarded-For (set by Vercel/proxies) over the raw IP.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For may be a comma-separated list; use the first (client) IP
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return 'unknown'
}
