import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, isAdmin } from '$lib/server/admin'
import { parse } from 'csv-parse/sync'
import { getCardTypeFromSerial } from '$lib/utils'
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
}

function parseBoolean(value: string): boolean {
  return value?.toUpperCase() === 'TRUE'
}

function parseIsNew(value: string): boolean {
  return value?.includes('🆕') || value?.toUpperCase() === 'TRUE'
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
      card_type: getCardTypeFromSerial(row.Serial),
      is_retro: parseBoolean(row['Retro?']),
      is_extended: parseBoolean(row['Extended?']),
      is_showcase: parseBoolean(row['Showcase?']),
      is_borderless: parseBoolean(row['Borderless?']),
      is_etched: parseBoolean(row['Etched?']),
      is_foil: row['Foil?']?.length > 0,
      foil_type: row['Foil?'] && row['Foil?'] !== 'TRUE' ? row['Foil?'] : null,
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
      is_new: parseIsNew(row['🆕'])
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

    console.log(`📤 Upserting ${uniqueCards.length} unique cards...`)

    // Fetch existing cards with converted Google Photos URLs to preserve them
    const existingConvertedUrls = new Map<string, string>()
    let offset = 0
    const fetchBatchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data: existingCards } = await adminClient
        .from('cards')
        .select('serial, ron_image_url')
        .like('ron_image_url', 'https://lh3.googleusercontent.com/%')
        .range(offset, offset + fetchBatchSize - 1)

      if (existingCards && existingCards.length > 0) {
        existingCards.forEach((card) => {
          if (card.ron_image_url) {
            existingConvertedUrls.set(card.serial, card.ron_image_url)
          }
        })
        offset += fetchBatchSize
        hasMore = existingCards.length === fetchBatchSize
      } else {
        hasMore = false
      }
    }

    console.log(`📷 Found ${existingConvertedUrls.size} cards with converted URLs to preserve`)

    // Preserve converted URLs
    const cardsToUpsert = uniqueCards.map((card) => {
      const existingUrl = existingConvertedUrls.get(card.serial)
      if (existingUrl) {
        return { ...card, ron_image_url: existingUrl }
      }
      return card
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
      duplicateGroups.forEach(group => {
        group.markedOosSerials.forEach(serial => oosSerials.add(serial))
      })

      // Mark duplicates as out of stock in the cards to upsert
      cardsToUpsert.forEach(card => {
        if (oosSerials.has(card.serial)) {
          card.is_in_stock = false
        }
      })

      duplicatesResolved = oosSerials.size
      console.log(`📝 Marked ${duplicatesResolved} duplicate serials as out of stock`)
    }

    // Upsert in batches
    const batchSize = 100
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < cardsToUpsert.length; i += batchSize) {
      const batch = cardsToUpsert.slice(i, i + batchSize)

      const { error: upsertError } = await adminClient.from('cards').upsert(batch, {
        onConflict: 'serial',
        ignoreDuplicates: false
      })

      if (upsertError) {
        console.error(`❌ Error upserting batch ${Math.floor(i / batchSize) + 1}:`, upsertError.message)
        errorCount += batch.length
      } else {
        successCount += batch.length
      }
    }

    // Get final count
    const { count } = await adminClient.from('cards').select('*', { count: 'exact', head: true })

    // Create admin alerts for duplicates after successful upsert
    if (duplicateGroups.length > 0) {
      console.log(`🚨 Creating ${duplicateGroups.length} admin alerts for duplicates...`)
      const result = await resolveDuplicates(adminClient, duplicateGroups)
      alertsCreated = result.alertsCreated
      
      if (result.errors.length > 0) {
        console.error(`❌ ${result.errors.length} errors creating alerts:`, result.errors)
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
    console.error('❌ Sync failed:', err)
    if (err instanceof Error && 'status' in err) {
      throw err
    }
    throw error(500, err instanceof Error ? err.message : 'Failed to sync with Google Sheets')
  }
}
