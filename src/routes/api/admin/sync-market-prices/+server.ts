/**
 * Admin: Sync Market Prices from Scryfall
 *
 * POST /api/admin/sync-market-prices
 *
 * Fetches all cards with a scryfall_id, queries Scryfall's /cards/collection
 * endpoint in batches of 75, resolves the finish-aware USD price
 * (with EUR×1.08 fallback), and bulk-updates market_price_usd in the DB.
 *
 * Returns: { updated: number, skipped: number, elapsed_ms: number }
 */
import { json, error } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import { isAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

const SCRYFALL_BATCH_SIZE = 75
const SCRYFALL_DELAY_MS = 120 // be polite to Scryfall
const EUR_TO_USD = 1.08

async function requireAdmin(locals: RequestEvent['locals']) {
  const { data: userData } = await locals.supabase
    .from('users')
    .select('discord_id')
    .eq('id', locals.user?.id ?? '')
    .single()

  if (!locals.user || !(await isAdmin(userData?.discord_id))) {
    throw error(403, 'Forbidden')
  }
}

/** Resolve finish-aware USD price from a Scryfall prices object */
function resolvePrice(
  prices: Record<string, string | null>,
  cardType: string,
  foilType: string | null,
  isEtched: boolean | null
): number | null {
  const finish = foilType ?? cardType

  let usd: string | null = null

  if (isEtched) {
    usd = prices.usd_etched ?? prices.usd_foil ?? prices.usd ?? null
  } else if (
    finish === 'Foil' ||
    finish === 'Galaxy Foil' ||
    finish === 'Raised Foil' ||
    finish === 'Surge Foil' ||
    finish === 'Serialized'
  ) {
    usd = prices.usd_foil ?? prices.usd ?? null
  } else {
    // Normal / Holo (non-foil)
    usd = prices.usd ?? null
  }

  if (usd !== null && usd !== '') {
    const parsed = parseFloat(usd)
    return isNaN(parsed) ? null : parsed
  }

  // EUR fallback
  let eur: string | null = null
  if (isEtched) {
    eur = prices.eur_foil ?? prices.eur ?? null
  } else if (
    finish === 'Foil' ||
    finish === 'Galaxy Foil' ||
    finish === 'Raised Foil' ||
    finish === 'Surge Foil' ||
    finish === 'Serialized'
  ) {
    eur = prices.eur_foil ?? prices.eur ?? null
  } else {
    eur = prices.eur ?? null
  }

  if (eur !== null && eur !== '') {
    const parsed = parseFloat(eur)
    return isNaN(parsed) ? null : Math.round(parsed * EUR_TO_USD * 100) / 100
  }

  return null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST({ locals }: RequestEvent) {
  await requireAdmin(locals)

  const start = Date.now()

  // 1. Fetch all cards with a scryfall_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cards, error: fetchError } = await (locals.supabase as any)
    .from('cards')
    .select('id, scryfall_id, card_type, foil_type, is_etched')
    .not('scryfall_id', 'is', null)

  if (fetchError) {
    logger.error({ error: fetchError }, 'sync-market-prices: failed to fetch cards')
    throw error(500, fetchError.message)
  }

  if (!cards || cards.length === 0) {
    return json({ updated: 0, skipped: 0, elapsed_ms: 0 })
  }

  // 2. Chunk into groups of 75
  const chunks: typeof cards[] = []
  for (let i = 0; i < cards.length; i += SCRYFALL_BATCH_SIZE) {
    chunks.push(cards.slice(i, i + SCRYFALL_BATCH_SIZE))
  }

  // Map scryfall_id → card row for lookups
  const cardMap = new Map<string, (typeof cards)[number]>()
  for (const card of cards) {
    if (card.scryfall_id) cardMap.set(card.scryfall_id, card)
  }

  let updated = 0
  let skipped = 0

  // 3. Fetch Scryfall and accumulate updates
  const updates: Array<{ id: string; market_price_usd: number | null }> = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const identifiers = chunk.map((c: { scryfall_id: string }) => ({ id: c.scryfall_id }))

    try {
      const resp = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RonGroupBuy/1.0'
        },
        body: JSON.stringify({ identifiers })
      })

      if (!resp.ok) {
        logger.warn({ status: resp.status, chunk: i }, 'sync-market-prices: Scryfall error, skipping chunk')
        skipped += chunk.length
        continue
      }

      const body = await resp.json()
      const scryfallCards: Array<{
        id: string
        prices: Record<string, string | null>
      }> = body.data ?? []

      for (const sc of scryfallCards) {
        const cardRow = cardMap.get(sc.id)
        if (!cardRow) {
          skipped++
          continue
        }
        const price = resolvePrice(sc.prices ?? {}, cardRow.card_type, cardRow.foil_type, cardRow.is_etched)
        updates.push({ id: cardRow.id, market_price_usd: price })
      }

      // Count Scryfall "not found" entries as skipped
      skipped += (body.not_found ?? []).length
    } catch (err) {
      logger.error({ err, chunk: i }, 'sync-market-prices: fetch error for chunk')
      skipped += chunk.length
    }

    // Be polite — wait between chunks (skip delay after last chunk)
    if (i < chunks.length - 1) {
      await sleep(SCRYFALL_DELAY_MS)
    }
  }

  // 4. Bulk-update the DB (batch by 500 to stay within supabase limits)
  const UPDATE_BATCH = 500
  const now = new Date().toISOString()

  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    const batch = updates.slice(i, i + UPDATE_BATCH)

    for (const u of batch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (locals.supabase as any)
        .from('cards')
        .update({ market_price_usd: u.market_price_usd, market_price_updated_at: now })
        .eq('id', u.id)

      if (updateError) {
        logger.error({ error: updateError, cardId: u.id }, 'sync-market-prices: failed to update card')
        skipped++
      } else {
        updated++
      }
    }
  }

  const elapsed_ms = Date.now() - start
  logger.info({ updated, skipped, elapsed_ms }, 'sync-market-prices: complete')

  return json({ updated, skipped, elapsed_ms })
}
