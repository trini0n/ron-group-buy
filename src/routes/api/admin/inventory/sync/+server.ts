import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdmin } from '$lib/server/admin'
import { parse } from 'csv-parse/sync'
import { getCardTypeFromSerial } from '$lib/utils'
import { logger } from '$lib/server/logger'
import { detectDuplicatesInBatch, resolveDuplicates, type CardWithIdentity } from '$lib/server/card-identity'

// Published CSV URL for the Library sheet
const LIBRARY_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSMUbO_Hsty-uIqFPWL2RdYyZ4nWPCHoW9n1YApAdZeg9A8JUGfME_dPyNSWpSamE6_DOAMYQOevvlK/pub?gid=1297811197&single=true&output=csv'

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
  is_retro: boolean
  is_extended: boolean
  is_showcase: boolean
  is_borderless: boolean
  is_etched: boolean
  is_foil: boolean
  foil_type: string | null
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
    // Fetch CSV from Google Sheets
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

    // Deduplicate by serial (keep first occurrence)
    const seenSerials = new Set<string>()
    const uniqueCards = cards.filter((card) => {
      if (seenSerials.has(card.serial)) {
        return false
      }
      seenSerials.add(card.serial)
      return true
    })

    console.log(`📊 Parsed ${uniqueCards.length} unique cards from sheet`)

    // Single fetch: get serial, ron_image_url, and is_in_stock for all existing cards.
    // This replaces two separate filtered fetches and also tells us which serials already
    // exist (so we can INSERT new ones and UPDATE existing ones separately — bypassing the
    // unreliable upsert() ON CONFLICT behaviour for non-PK unique columns).
    type ExistingCard = { ron_image_url: string | null; is_in_stock: boolean | null }
    const existingDbCards = new Map<string, ExistingCard>()
    let offset = 0
    const fetchBatchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: dbBatch } = await adminClient
        .from('cards')
        .select('serial, ron_image_url, is_in_stock')
        .range(offset, offset + fetchBatchSize - 1)

      if (dbBatch && dbBatch.length > 0) {
        dbBatch.forEach((card) => {
          existingDbCards.set(card.serial, {
            ron_image_url: card.ron_image_url,
            is_in_stock: card.is_in_stock
          })
        })
        offset += fetchBatchSize
        hasMore = dbBatch.length === fetchBatchSize
      } else {
        hasMore = false
      }
    }

    console.log(`📋 Found ${existingDbCards.size} existing cards in DB`)

    // Preserve converted Google Photos URLs and apply OOS priority (DB OOS=TRUE wins)
    const cardsToUpsert = uniqueCards.map((card) => {
      const existing = existingDbCards.get(card.serial)
      // Preserve converted URL if DB already holds a lh3.googleusercontent.com URL
      const existingUrl = existing?.ron_image_url
      const ron_image_url =
        existingUrl && existingUrl.startsWith('https://lh3.googleusercontent.com/') ? existingUrl : card.ron_image_url
      // OOS priority: if DB already marks this serial OOS, keep it OOS even if sheet says in-stock.
      // Sheet OOS=TRUE always wins too (card.is_in_stock will already be false in that case).
      const is_in_stock = existing && !existing.is_in_stock ? false : card.is_in_stock
      return { ...card, ron_image_url, is_in_stock }
    })

    // Detect duplicate card identities before upserting
    console.log('🔍 Detecting duplicate card identities...')
    const cardsWithIdentity: CardWithIdentity[] = cardsToUpsert.map((card) => ({
      id: '', // Will be assigned by DB
      serial: card.serial,
      card_name: card.card_name,
      set_code: card.set_code,
      collector_number: card.collector_number,
      is_foil: card.is_foil,
      is_etched: card.is_etched,
      language: card.language,
      is_in_stock: card.is_in_stock
    }))

    const duplicateGroups = detectDuplicatesInBatch(cardsWithIdentity)

    let duplicatesResolved = 0
    let alertsCreated = 0

    if (duplicateGroups.length > 0) {
      console.log(`⚠️  Found ${duplicateGroups.length} duplicate identity groups`)

      // Update cards array to mark lower serials as OOS
      const oosSerials = new Set<string>()
      duplicateGroups.forEach((group) => {
        group.markedOosSerials.forEach((serial) => oosSerials.add(serial))
      })

      // Mark duplicates as out of stock in the cards to upsert
      cardsToUpsert.forEach((card) => {
        if (oosSerials.has(card.serial)) {
          card.is_in_stock = false
        }
      })

      duplicatesResolved = oosSerials.size
      console.log(`📝 Marked ${duplicatesResolved} duplicate serials as out of stock`)
    }

    // Separate new cards (INSERT) from existing ones (UPDATE).
    // We avoid upsert() here because Supabase's ON CONFLICT DO UPDATE for non-PK unique
    // columns (serial) does not reliably update existing rows — existing records silently
    // remain unchanged. Explicit INSERT + UPDATE guarantees sheet data overwrites DB.
    const toInsert = cardsToUpsert.filter((c) => !existingDbCards.has(c.serial))
    const toUpdate = cardsToUpsert.filter((c) => existingDbCards.has(c.serial))

    console.log(`➕ Inserting ${toInsert.length} new cards, ✏️  updating ${toUpdate.length} existing cards...`)

    const batchSize = 100
    let successCount = 0
    let errorCount = 0

    // INSERT new cards in batches
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize)
      const { error: insertError } = await adminClient.from('cards').insert(batch)
      if (insertError) {
        logger.error(
          { error: insertError.message, batch: Math.floor(i / batchSize) + 1 },
          'Error inserting new cards batch'
        )
        errorCount += batch.length
      } else {
        successCount += batch.length
      }
    }

    // UPDATE existing cards in parallel batches (sheet is source of truth for all fields)
    const updateConcurrency = 50
    for (let i = 0; i < toUpdate.length; i += updateConcurrency) {
      const batch = toUpdate.slice(i, i + updateConcurrency)
      const results = await Promise.all(
        batch.map(({ serial, ...data }) => adminClient.from('cards').update(data).eq('serial', serial))
      )
      results.forEach((result, idx) => {
        if (result.error) {
          logger.error({ error: result.error.message, serial: batch[idx].serial }, 'Error updating existing card')
          errorCount++
        } else {
          successCount++
        }
      })
    }

    // Get final count
    const { count } = await adminClient.from('cards').select('*', { count: 'exact', head: true })

    // Create admin alerts for duplicates after successful upsert
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

    console.log(`🎉 Sync complete! Success: ${successCount}, Errors: ${errorCount}, Total: ${count}`)
    console.log(`   Duplicates resolved: ${duplicatesResolved}, Alerts created: ${alertsCreated}`)

    return json({
      success: successCount,
      errors: errorCount,
      total: count || 0,
      duplicates_resolved: duplicatesResolved,
      alerts_created: alertsCreated
    })
  } catch (err) {
    logger.error({ error: err }, 'Sync failed')
    if (err instanceof Error && 'status' in err) {
      throw err
    }
    throw error(500, err instanceof Error ? err.message : 'Failed to sync with Google Sheets')
  }
}
