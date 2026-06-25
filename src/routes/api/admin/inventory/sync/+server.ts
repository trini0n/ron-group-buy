import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { createAdminClient, isAdmin } from '$lib/server/admin'
import { parse } from 'csv-parse/sync'
import { getCardTypeFromSerial } from '$lib/utils'
import { logger } from '$lib/server/logger'
import { detectDuplicatesInBatch, resolveDuplicates, type CardWithIdentity } from '$lib/server/card-identity'

// Published CSV URL for the Library sheet — configured via GOOGLE_SHEETS_LIBRARY_URL env var
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

// All mutable columns fetched from the DB for skip-unchanged comparison.
type ExistingCard = Omit<CardRecord, 'serial'>

function parseBoolean(value: string): boolean {
  return value?.toUpperCase() === 'TRUE'
}

function parseIsNew(value: string): boolean {
  return value?.includes('🆕') || value?.toUpperCase() === 'TRUE'
}

/**
 * Determine the finish (card_type + foil_type) from the three authoritative sources
 * in priority order:
 *  1. 'Card Type' column (most explicit — admin-curated, e.g. "Raised Foil")
 *  2. Serial suffix   (r = Raised Foil, z = Serialized)
 *  3. Foil? column    (e.g. "Surge Foil") / serial prefix fallback (F- = Foil, H- = Holo)
 *
 * card_type is always stored as the base physical type ('Normal' | 'Holo' | 'Foil')
 * because that's what the existing pricing and DB schema expect at the column level.
 * foil_type carries the specific finish label used for display, filtering, and pricing.
 */
function parseFinishFromRow(row: CsvRow): { card_type: 'Normal' | 'Holo' | 'Foil'; foil_type: string | null } {
  const sheetType = row['Card Type']?.trim()

  // ── Priority 1: explicit 'Card Type' column value ──────────────────────────
  if (sheetType === 'Raised Foil') return { card_type: 'Foil', foil_type: 'Raised Foil' }
  if (sheetType === 'Serialized') return { card_type: 'Foil', foil_type: 'Serialized' }
  if (sheetType === 'Surge Foil') return { card_type: 'Foil', foil_type: 'Surge Foil' }
  if (sheetType === 'Galaxy Foil') return { card_type: 'Foil', foil_type: 'Galaxy Foil' }
  if (sheetType === 'Holo') return { card_type: 'Holo', foil_type: null }
  if (sheetType === 'Foil') return { card_type: 'Foil', foil_type: null }
  if (sheetType === 'Normal') return { card_type: 'Normal', foil_type: null }

  // ── Priority 2: serial suffix (e.g. F-3005r = Raised Foil, F-3006z = Serialized, F-3007g = Galaxy Foil) ─
  const serial = row.Serial || ''
  if (/^[A-Z]-\d+r$/i.test(serial)) return { card_type: 'Foil', foil_type: 'Raised Foil' }
  if (/^[A-Z]-\d+z$/i.test(serial)) return { card_type: 'Foil', foil_type: 'Serialized' }
  if (/^[A-Z]-\d+g$/i.test(serial)) return { card_type: 'Foil', foil_type: 'Galaxy Foil' }

  // ── Priority 3: Foil? column + serial prefix (existing logic) ────────────────
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
      // foil_type is set by parseFinishFromRow above
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

/**
 * Produces a lightweight fingerprint of all mutable card fields so we can
 * skip cards that haven't changed since the last sync.
 *
 * Note: ron_image_url and is_in_stock are intentionally excluded from the
 * fingerprint — the SQL function handles their preservation rules
 * (lh3 URL retention, OOS priority) server-side.  Including them here
 * would cause unnecessary skips when the DB already holds a converted URL
 * or a manually-set OOS flag.
 */
function cardFingerprint(card: Omit<CardRecord, 'serial' | 'ron_image_url' | 'is_in_stock'>): string {
  return [
    card.naming,
    card.card_name,
    card.set_name,
    card.set_code,
    card.collector_number,
    card.card_type,
    card.foil_type,
    card.is_retro,
    card.is_extended,
    card.is_showcase,
    card.is_borderless,
    card.is_etched,
    card.is_foil,
    card.language,
    card.flavor_name,
    card.scryfall_link,
    card.scryfall_id,
    card.moxfield_syntax,
    card.color,
    card.color_identity,
    card.type_line,
    card.mana_cost,
    card.is_new,
    card.is_misprint
  ]
    .map((v) => String(v ?? ''))
    .join('|')
}

// Helper to verify admin access
async function verifyAdmin(locals: App.Locals) {
  const user = locals.user
  if (!user) {
    throw error(401, 'Not authenticated')
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient.from('users').select('discord_id').eq('id', user.id).single()

  if (!(await isAdmin(userData?.discord_id))) {
    throw error(403, 'Not authorized')
  }

  return { user, adminClient }
}

export const POST: RequestHandler = async ({ locals }) => {
  const { adminClient } = await verifyAdmin(locals)

  try {
    // ── Step 1: Fetch CSV from Google Sheets (single HTTP round-trip) ─────────
    console.log('📥 Fetching Library from Google Sheets...')
    const response = await fetch(LIBRARY_CSV_URL)

    if (!response.ok) {
      throw new Error(`Failed to fetch Library: ${response.status} ${response.statusText}`)
    }

    const csvContent = await response.text()
    const cards = parseSheetCsv(csvContent)

    console.log(`📊 Found ${cards.length} cards in Library`)

    if (cards.length === 0) {
      throw error(400, 'No cards found in Google Sheet. Check if CSV is published correctly.')
    }

    // ── Step 2: Deduplicate by serial (keep first occurrence) ─────────────────
    const seenSerials = new Set<string>()
    const uniqueCards = cards.filter((card) => {
      if (seenSerials.has(card.serial)) {
        return false
      }
      seenSerials.add(card.serial)
      return true
    })

    console.log(`📊 Parsed ${uniqueCards.length} unique cards from sheet`)

    // ── Step 3: Fetch all existing cards from DB ──────────────────────────────
    // We read all mutable columns so we can:
    //   a) Build a fingerprint to skip cards that haven't changed.
    //   b) Know which serials already exist (for duplicate detection counts).
    //
    // ron_image_url and is_in_stock are read but excluded from the fingerprint
    // because the SQL function applies preservation rules for them server-side.
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

    console.log(`📋 Found ${existingDbCards.size} existing cards in DB`)

    // ── Step 4: Duplicate-identity detection ──────────────────────────────────
    const cardsWithIdentity: CardWithIdentity[] = uniqueCards.map((card) => ({
      id: '', // Will be assigned by DB
      serial: card.serial,
      card_name: card.card_name,
      set_code: card.set_code,
      collector_number: card.collector_number,
      card_type: card.card_type, // Included so Holo vs Foil variants are distinct identities
      is_foil: card.is_foil,
      is_etched: card.is_etched,
      language: card.language,
      is_in_stock: card.is_in_stock
    }))

    const duplicateGroups = detectDuplicatesInBatch(cardsWithIdentity)

    let duplicatesResolved = 0
    let alertsCreated = 0

    // Mark lower serials as OOS before the upsert
    const oosSerials = new Set<string>()
    if (duplicateGroups.length > 0) {
      console.log(`⚠️  Found ${duplicateGroups.length} duplicate identity groups`)
      duplicateGroups.forEach((group) => {
        group.markedOosSerials.forEach((serial) => oosSerials.add(serial))
      })
      duplicatesResolved = oosSerials.size
      console.log(`📝 Marked ${duplicatesResolved} duplicate serials as out of stock`)
    }

    // ── Step 5: Skip-unchanged filtering ─────────────────────────────────────
    // Only send cards that are new or whose mutable fields have changed.
    // ron_image_url and is_in_stock are excluded from the fingerprint —
    // preservation rules for both are enforced server-side in sync_cards_bulk.
    const cardsToSync = uniqueCards
      .map((card) => ({
        ...card,
        // Apply OOS override for duplicates before comparing/sending
        is_in_stock: oosSerials.has(card.serial) ? false : card.is_in_stock
      }))
      .filter((card) => {
        const existing = existingDbCards.get(card.serial)
        if (!existing) return true // New card — always include

        const incomingFp = cardFingerprint(card)
        const existingFp = cardFingerprint(existing)
        return incomingFp !== existingFp
      })

    const skipped = uniqueCards.length - cardsToSync.length
    console.log(
      `🔍 ${cardsToSync.length} cards changed (${skipped} skipped — unchanged since last sync)`
    )

    let inserted = 0
    let updated = 0
    let errorCount = 0

    if (cardsToSync.length > 0) {
      // ── Step 6: Single bulk upsert via RPC ───────────────────────────────────
      // sync_cards_bulk() runs one INSERT … ON CONFLICT DO UPDATE in Postgres,
      // replacing the previous pattern of hundreds of individual UPDATE queries.
      console.log(`🚀 Calling sync_cards_bulk with ${cardsToSync.length} cards...`)

      const { data: rpcResult, error: rpcError } = await adminClient.rpc('sync_cards_bulk', {
        p_cards: cardsToSync
      })

      if (rpcError) {
        logger.error({ error: rpcError.message }, 'sync_cards_bulk RPC failed')
        throw new Error(`Bulk sync failed: ${rpcError.message}`)
      }

      inserted = Number((rpcResult as { inserted: number; updated: number })?.inserted ?? 0)
      updated = Number((rpcResult as { inserted: number; updated: number })?.updated ?? 0)
      errorCount = cardsToSync.length - inserted - updated
    }

    // ── Step 7: Create admin alerts for duplicates ────────────────────────────
    if (duplicateGroups.length > 0) {
      console.log(`🚨 Creating ${duplicateGroups.length} admin alerts for duplicates...`)
      const result = await resolveDuplicates(adminClient, duplicateGroups)
      alertsCreated = result.alertsCreated

      if (result.errors.length > 0) {
        logger.error({ errors: result.errors }, 'Errors creating duplicate alerts')
      } else {
        console.log(`✅ Created ${alertsCreated} duplicate alerts for admin review`)
      }
    }

    // Get final count
    const { count } = await adminClient.from('cards').select('*', { count: 'exact', head: true })

    const successCount = inserted + updated
    console.log(
      `🎉 Sync complete! Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errorCount}, Total: ${count}`
    )
    console.log(`   Duplicates resolved: ${duplicatesResolved}, Alerts created: ${alertsCreated}`)

    return json({
      success: successCount,
      errors: errorCount,
      total: count || 0,
      duplicates_resolved: duplicatesResolved,
      alerts_created: alertsCreated,
      // Extra detail for the admin UI
      inserted,
      updated,
      skipped
    })
  } catch (err) {
    logger.error({ error: err }, 'Sync failed')
    if (err instanceof Error && 'status' in err) {
      throw err
    }
    throw error(500, err instanceof Error ? err.message : 'Failed to sync with Google Sheets')
  }
}
