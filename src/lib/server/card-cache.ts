/**
 * Shared in-memory card cache.
 * Used by +page.server.ts (read) and sync endpoint (invalidate after sync).
 */
import type { Card } from '$lib/server/types'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

let cardsCache: CacheEntry<Card[]> | null = null
let setsCache: CacheEntry<{ code: string; name: string }[]> | null = null

export function isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL_MS
}

export function getCardsCache() { return cardsCache }
export function setCardsCache(data: Card[]) { cardsCache = { data, timestamp: Date.now() } }

export function getSetsCache() { return setsCache }
export function setSetsCache(data: { code: string; name: string }[]) { setsCache = { data, timestamp: Date.now() } }

/** Invalidate cards and sets caches (call after sync). */
export function invalidateCardsCaches() {
  cardsCache = null
  setsCache = null
}
