/**
 * Admin: Sync Market Prices from Scryfall
 *
 * POST /api/admin/sync-market-prices
 *
 * Streams newline-delimited JSON progress events back to the client so the
 * browser connection stays alive for the full duration of the sync. Each
 * Scryfall chunk emits a { type: 'progress', chunk, totalChunks, fetched }
 * event. On completion: { type: 'done', updated, skipped, elapsed_ms }.
 * On error: { type: 'error', message }.
 *
 * The streaming response keeps the HTTP connection open, so the sync
 * survives as long as the browser tab stays on the page.
 */
import { error } from '@sveltejs/kit'
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

  // Capture supabase client before streaming (locals may not be available in async stream)
  const supabase = locals.supabase as any // eslint-disable-line @typescript-eslint/no-explicit-any

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'))
      }

      try {
        // 1. Paginated fetch of all cards with a scryfall_id
        send({ type: 'status', message: 'Fetching cards from database…' })

        const DB_BATCH = 1000
        let offset = 0
        let hasMore = true
        const allCards: Array<{
          id: string
          scryfall_id: string
          card_type: string
          foil_type: string | null
          is_etched: boolean | null
        }> = []

        while (hasMore) {
          const { data: batch, error: fetchError } = await supabase
            .from('cards')
            .select('id, scryfall_id, card_type, foil_type, is_etched')
            .not('scryfall_id', 'is', null)
            .range(offset, offset + DB_BATCH - 1)

          if (fetchError) {
            logger.error({ error: fetchError }, 'sync-market-prices: failed to fetch cards')
            send({ type: 'error', message: fetchError.message })
            controller.close()
            return
          }

          if (batch && batch.length > 0) {
            allCards.push(...batch)
            offset += DB_BATCH
            hasMore = batch.length === DB_BATCH
          } else {
            hasMore = false
          }
        }

        if (allCards.length === 0) {
          send({ type: 'done', updated: 0, skipped: 0, elapsed_ms: 0 })
          controller.close()
          return
        }

        send({ type: 'status', message: `Found ${allCards.length} cards. Fetching Scryfall prices…` })

        // 2. Group cards by scryfall_id (multiple finishes share the same ID)
        const cardMap = new Map<string, (typeof allCards)[number][]>()
        for (const card of allCards) {
          if (card.scryfall_id) {
            const existing = cardMap.get(card.scryfall_id)
            if (existing) existing.push(card)
            else cardMap.set(card.scryfall_id, [card])
          }
        }

        // Chunk unique scryfall_ids into Scryfall batches of 75
        const uniqueIds = [...cardMap.keys()]
        const idChunks: string[][] = []
        for (let i = 0; i < uniqueIds.length; i += SCRYFALL_BATCH_SIZE) {
          idChunks.push(uniqueIds.slice(i, i + SCRYFALL_BATCH_SIZE))
        }

        let fetched = 0
        let skipped = 0
        const updates: Array<{ id: string; market_price_usd: number | null }> = []

        // 3. Fetch Scryfall prices, streaming progress per chunk
        for (let i = 0; i < idChunks.length; i++) {
          const chunk = idChunks[i]!
          const identifiers = chunk.map((scryfallId) => ({ id: scryfallId }))

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
            } else {
              const body = await resp.json()
              const scryfallCards: Array<{ id: string; prices: Record<string, string | null> }> =
                body.data ?? []

              for (const sc of scryfallCards) {
                const cardRows = cardMap.get(sc.id)
                if (!cardRows) { skipped++; continue }
                for (const cardRow of cardRows) {
                  const price = resolvePrice(sc.prices ?? {}, cardRow.card_type, cardRow.foil_type, cardRow.is_etched)
                  updates.push({ id: cardRow.id, market_price_usd: price })
                  fetched++
                }
              }

              skipped += (body.not_found ?? []).length
            }
          } catch (err) {
            logger.error({ err, chunk: i }, 'sync-market-prices: fetch error for chunk')
            skipped += chunk.length
          }

          // Emit progress after each chunk
          send({
            type: 'progress',
            chunk: i + 1,
            totalChunks: idChunks.length,
            fetched,
            skipped,
            totalCards: allCards.length
          })

          // Polite delay between Scryfall requests (skip after last chunk)
          if (i < idChunks.length - 1) {
            await sleep(SCRYFALL_DELAY_MS)
          }
        }

        // 4. Bulk-update the DB grouped by price value
        send({ type: 'status', message: `Writing ${updates.length} prices to database…` })

        const now = new Date().toISOString()
        const IN_BATCH_SIZE = 500
        let updated = 0

        // Group card IDs by resolved price to minimise DB round-trips
        const priceGroups = new Map<string, string[]>()
        for (const u of updates) {
          const key = u.market_price_usd === null ? '__null__' : String(u.market_price_usd)
          const bucket = priceGroups.get(key)
          if (bucket) { bucket.push(u.id) } else { priceGroups.set(key, [u.id]) }
        }

        for (const [priceKey, ids] of priceGroups) {
          const priceValue = priceKey === '__null__' ? null : parseFloat(priceKey)
          for (let i = 0; i < ids.length; i += IN_BATCH_SIZE) {
            const idChunk = ids.slice(i, i + IN_BATCH_SIZE)
            const { error: updateError } = await supabase
              .from('cards')
              .update({ market_price_usd: priceValue, market_price_updated_at: now })
              .in('id', idChunk)

            if (updateError) {
              logger.error({ error: updateError, priceKey, chunkSize: idChunk.length }, 'sync-market-prices: batch update failed')
              skipped += idChunk.length
            } else {
              updated += idChunk.length
            }
          }
        }

        const elapsed_ms = Date.now() - start
        logger.info({ updated, skipped, elapsed_ms, totalCards: allCards.length }, 'sync-market-prices: complete')

        send({ type: 'done', updated, skipped, elapsed_ms })
      } catch (err) {
        logger.error({ err }, 'sync-market-prices: unexpected error')
        send({ type: 'error', message: 'Unexpected error during sync' })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache'
    }
  })
}
