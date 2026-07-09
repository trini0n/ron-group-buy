import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { createAdminClient, isAdmin } from '$lib/server/admin'
import { parse } from 'csv-parse/sync'
import { getCardTypeFromSerial } from '$lib/utils'
import { logger } from '$lib/server/logger'
import { detectDuplicatesInBatch, resolveDuplicates, type CardWithIdentity } from '$lib/server/card-identity'

/**
 * POST /api/admin/inventory/sync
 *
 * Streams newline-delimited JSON progress events so the browser connection
 * stays alive for the full sync duration. Event shapes:
 *   { type: 'progress', step, totalSteps, message }
 *   { type: 'done', success, errors, total, inserted, updated, skipped, duplicates_resolved, alerts_created }
 *   { type: 'error', message }
 */

const LIBRARY_CSV_URL = env.GOOGLE_SHEETS_LIBRARY_URL ?? ''

interface CsvRow {
  Serial: string
  Naming: string
  'Card Name': string
  'Set Name': string
  'Retro?': string
  'Extended?': string
  'Showcase?': string
  'Borderless?': string
  'Etched?': string
  'Foil?': string
  Language: string
  'Flavor Name': string
  Link: string
  'Card Type': string
  Set: string
  'Collector #': string
  Color: string
  'Color Identity': string
  'Type Line': string
  'Mana Cost': string
  'Scryfall ID': string
  Coding: string
  'Ron Print': string
  OOS: string
  '🆕': string
  Misprint: string
}

interface CardRecord {
  serial: string
  naming: string | null
  card_name: string
  set_name: string | null
  set_code: string | null
  collector_number: string | null
  card_type: 'Normal' | 'Holo' | 'Foil'
  foil_type: string | null
  is_retro: boolean
  is_extended: boolean
  is_showcase: boolean
  is_borderless: boolean
  is_etched: boolean
  is_foil: boolean
  language: string
  flavor_name: string | null
  scryfall_link: string | null
  scryfall_id: string | null
  moxfield_syntax: string | null
  color: string | null
  color_identity: string | null
  type_line: string | null
  mana_cost: string | null
  ron_image_url: string | null
  is_in_stock: boolean
  is_new: boolean
  is_misprint: boolean
}

type ExistingCard = Omit<CardRecord, 'serial'>

function parseBoolean(value: string): boolean {
  return value?.toUpperCase() === 'TRUE'
}

function parseIsNew(value: string): boolean {
  return value?.includes('🆕') || value?.toUpperCase() === 'TRUE'
}

function parseFinishFromRow(row: CsvRow): { card_type: 'Normal' | 'Holo' | 'Foil'; foil_type: string | null } {
  const sheetType = row['Card Type']?.trim()
  if (sheetType === 'Raised Foil') return { card_type: 'Foil', foil_type: 'Raised Foil' }
  if (sheetType === 'Serialized')  return { card_type: 'Foil', foil_type: 'Serialized' }
  if (sheetType === 'Surge Foil')  return { card_type: 'Foil', foil_type: 'Surge Foil' }
  if (sheetType === 'Galaxy Foil') return { card_type: 'Foil', foil_type: 'Galaxy Foil' }
  if (sheetType === 'Holo')        return { card_type: 'Holo', foil_type: null }
  if (sheetType === 'Foil')        return { card_type: 'Foil', foil_type: null }
  if (sheetType === 'Normal')      return { card_type: 'Normal', foil_type: null }

  const serial = row.Serial || ''
  if (/^[A-Z]-\d+r$/i.test(serial)) return { card_type: 'Foil', foil_type: 'Raised Foil' }
  if (/^[A-Z]-\d+z$/i.test(serial)) return { card_type: 'Foil', foil_type: 'Serialized' }
  if (/^[A-Z]-\d+g$/i.test(serial)) return { card_type: 'Foil', foil_type: 'Galaxy Foil' }

  const baseCardType = getCardTypeFromSerial(serial)
  const foilType = row['Foil?'] && row['Foil?'] !== 'TRUE' ? row['Foil?'] : null
  return { card_type: baseCardType, foil_type: foilType }
}

function parseSheetCsv(csvContent: string): CardRecord[] {
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  })

  return records
    .filter((row) => row.Serial && row['Card Name'])
    .map((row) => ({
      serial: row.Serial,
      naming: row.Naming || null,
      card_name: row['Card Name'],
      set_name: row['Set Name'] || null,
      set_code: row.Set || null,
      collector_number: row['Collector #'] || null,
      ...parseFinishFromRow(row),
      is_retro: parseBoolean(row['Retro?']),
      is_extended: parseBoolean(row['Extended?']),
      is_showcase: parseBoolean(row['Showcase?']),
      is_borderless: parseBoolean(row['Borderless?']),
      is_etched: parseBoolean(row['Etched?']),
      is_foil: row['Foil?']?.length > 0,
      language: row.Language || 'en',
      flavor_name: row['Flavor Name'] || null,
      scryfall_link: row.Link || null,
      scryfall_id: row['Scryfall ID'] || null,
      moxfield_syntax: row.Coding || null,
      color: row.Color || null,
      color_identity: row['Color Identity'] || null,
      type_line: row['Type Line'] || null,
      mana_cost: row['Mana Cost'] || null,
      ron_image_url: row['Ron Print'] || null,
      is_in_stock: !parseBoolean(row.OOS),
      is_new: parseIsNew(row['🆕']),
      is_misprint: parseBoolean(row['Misprint'])
    }))
}

function cardFingerprint(card: Omit<CardRecord, 'serial' | 'ron_image_url' | 'is_in_stock'>): string {
  return [
    card.naming, card.card_name, card.set_name, card.set_code, card.collector_number,
    card.card_type, card.foil_type, card.is_retro, card.is_extended, card.is_showcase,
    card.is_borderless, card.is_etched, card.is_foil, card.language, card.flavor_name,
    card.scryfall_link, card.scryfall_id, card.moxfield_syntax, card.color,
    card.color_identity, card.type_line, card.mana_cost, card.is_new, card.is_misprint
  ]
    .map((v) => String(v ?? ''))
    .join('|')
}

async function verifyAdmin(locals: App.Locals) {
  const user = locals.user
  if (!user) throw error(401, 'Not authenticated')
  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', user.id).single()
  if (!(await isAdmin(userData?.discord_id))) throw error(403, 'Not authorized')
  return { user, adminClient }
}

const TOTAL_STEPS = 7

export const POST: RequestHandler = async ({ locals }) => {
  const { adminClient } = await verifyAdmin(locals)

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'))
      }

      function progress(step: number, message: string) {
        send({ type: 'progress', step, totalSteps: TOTAL_STEPS, message })
      }

      try {
        // ── Step 1: Fetch CSV ────────────────────────────────────────────────
        progress(1, 'Fetching Library from Google Sheets…')
        const response = await fetch(LIBRARY_CSV_URL)
        if (!response.ok) {
          send({ type: 'error', message: `Failed to fetch Library: ${response.status} ${response.statusText}` })
          controller.close()
          return
        }

        const csvContent = await response.text()
        const cards = parseSheetCsv(csvContent)

        if (cards.length === 0) {
          send({ type: 'error', message: 'No cards found in Google Sheet. Check if CSV is published correctly.' })
          controller.close()
          return
        }

        // ── Step 2: Deduplicate by serial ────────────────────────────────────
        progress(2, `Parsed ${cards.length} rows — deduplicating…`)
        const seenSerials = new Set<string>()
        const uniqueCards = cards.filter((card) => {
          if (seenSerials.has(card.serial)) return false
          seenSerials.add(card.serial)
          return true
        })

        // ── Step 3: Fetch existing DB cards ──────────────────────────────────
        progress(3, `Found ${uniqueCards.length} unique cards — loading database…`)
        const existingDbCards = new Map<string, ExistingCard>()
        let offset = 0
        const fetchBatchSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data: rawBatch } = await adminClient
            .from('cards')
            .select(
              'serial, naming, card_name, set_name, set_code, collector_number, card_type, foil_type, ' +
              'is_retro, is_extended, is_showcase, is_borderless, is_etched, is_foil, language, ' +
              'flavor_name, scryfall_link, scryfall_id, moxfield_syntax, color, color_identity, ' +
              'type_line, mana_cost, ron_image_url, is_in_stock, is_new, is_misprint'
            )
            .range(offset, offset + fetchBatchSize - 1)

          const dbBatch = rawBatch as CardRecord[] | null
          if (dbBatch && dbBatch.length > 0) {
            dbBatch.forEach((card) => {
              const { serial, ...rest } = card
              existingDbCards.set(serial, rest as ExistingCard)
            })
            offset += fetchBatchSize
            hasMore = dbBatch.length === fetchBatchSize
          } else {
            hasMore = false
          }
        }

        // ── Step 4: Duplicate-identity detection ─────────────────────────────
        progress(4, `Loaded ${existingDbCards.size} existing cards — detecting duplicates…`)
        const cardsWithIdentity: CardWithIdentity[] = uniqueCards.map((card) => ({
          id: '',
          serial: card.serial,
          card_name: card.card_name,
          set_code: card.set_code,
          collector_number: card.collector_number,
          card_type: card.card_type,
          is_foil: card.is_foil,
          is_etched: card.is_etched,
          language: card.language,
          is_in_stock: card.is_in_stock,
          is_misprint: card.is_misprint
        }))

        const duplicateGroups = detectDuplicatesInBatch(cardsWithIdentity)
        let duplicatesResolved = 0

        const oosSerials = new Set<string>()
        if (duplicateGroups.length > 0) {
          duplicateGroups.forEach((group) => {
            group.markedOosSerials.forEach((serial) => oosSerials.add(serial))
          })
          duplicatesResolved = oosSerials.size
        }

        // ── Step 5: Skip-unchanged filtering ─────────────────────────────────
        progress(5, `Checking ${uniqueCards.length} cards for changes…`)
        const cardsToSync = uniqueCards
          .map((card) => ({
            ...card,
            is_in_stock: oosSerials.has(card.serial) ? false : card.is_in_stock
          }))
          .filter((card) => {
            const existing = existingDbCards.get(card.serial)
            if (!existing) return true
            return cardFingerprint(card) !== cardFingerprint(existing)
          })

        const skipped = uniqueCards.length - cardsToSync.length

        // ── Step 6: Bulk upsert ───────────────────────────────────────────────
        let inserted = 0
        let updated = 0
        let errorCount = 0

        if (cardsToSync.length > 0) {
          progress(6, `${cardsToSync.length} changed (${skipped} unchanged) — writing to database…`)
          const { data: rpcResult, error: rpcError } = await adminClient.rpc('sync_cards_bulk', {
            p_cards: cardsToSync
          })

          if (rpcError) {
            logger.error({ error: rpcError.message }, 'sync_cards_bulk RPC failed')
            send({ type: 'error', message: `Bulk sync failed: ${rpcError.message}` })
            controller.close()
            return
          }

          inserted = Number((rpcResult as { inserted: number; updated: number })?.inserted ?? 0)
          updated = Number((rpcResult as { inserted: number; updated: number })?.updated ?? 0)
          errorCount = cardsToSync.length - inserted - updated
        } else {
          progress(6, `All ${skipped} cards unchanged — no writes needed`)
        }

        // ── Step 7: Duplicate alerts ─────────────────────────────────────────
        let alertsCreated = 0
        if (duplicateGroups.length > 0) {
          progress(7, `Writing ${duplicateGroups.length} duplicate alerts…`)
          const result = await resolveDuplicates(adminClient, duplicateGroups)
          alertsCreated = result.alertsCreated
          if (result.errors.length > 0) {
            logger.error({ errors: result.errors }, 'Errors creating duplicate alerts')
          }
        } else {
          progress(7, 'No duplicates found — finishing up…')
        }

        const { count } = await adminClient.from('cards').select('*', { count: 'exact', head: true })
        const successCount = inserted + updated

        logger.info({ inserted, updated, skipped, errorCount, duplicatesResolved, alertsCreated }, 'Sheets sync complete')

        send({
          type: 'done',
          success: successCount,
          errors: errorCount,
          total: count || 0,
          duplicates_resolved: duplicatesResolved,
          alerts_created: alertsCreated,
          inserted,
          updated,
          skipped
        })
      } catch (err) {
        logger.error({ error: err }, 'Sync failed')
        send({ type: 'error', message: err instanceof Error ? err.message : 'Failed to sync with Google Sheets' })
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
