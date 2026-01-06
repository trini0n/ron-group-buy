/**
 * Card Sync Script
 *
 * Syncs cards from Google Sheets (Normal, Holo, Foil libraries) to Supabase.
 *
 * Usage:
 *   npm run sync:cards                    # Normal sync (upsert)
 *   npm run sync:cards -- --clean         # Delete all cards first, then sync
 *   npm run sync:cards -- --convert-photos # Convert Google Photos URLs to direct URLs
 *
 * Environment variables required:
 *   - PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * The Google Sheet must be published to web as CSV.
 * Go to File → Share → Publish to web → Select sheet → CSV format
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { getDirectPhotoUrl } from './convert-gphoto-urls'

// Load environment variables
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables. Please set:')
  console.error('  - PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Google Sheets configuration
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

function getCardTypeFromSerial(serial: string): 'Normal' | 'Holo' | 'Foil' {
  if (serial.startsWith('H-')) return 'Holo'
  if (serial.startsWith('F-')) return 'Foil'
  return 'Normal'
}

function parseSheetCsv(csvContent: string): CardRecord[] {
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true // Handle inconsistent column counts
  })

  return records
    .filter((row) => row.Serial && row['Card Name']) // Skip empty rows
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
      is_foil: parseBoolean(row['Foil?']),
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
      is_new: parseBoolean(row['🆕'])
    }))
}

async function upsertCards(cards: CardRecord[]): Promise<{ success: number; errors: number }> {
  const batchSize = 100
  let successCount = 0
  let errorCount = 0

  // Deduplicate by serial (keep first occurrence)
  const seenSerials = new Set<string>()
  const uniqueCards = cards.filter((card) => {
    if (seenSerials.has(card.serial)) {
      return false
    }
    seenSerials.add(card.serial)
    return true
  })

  console.log(
    `   📤 Upserting ${uniqueCards.length} unique cards (${cards.length - uniqueCards.length} duplicates removed)...`
  )

  for (let i = 0; i < uniqueCards.length; i += batchSize) {
    const batch = uniqueCards.slice(i, i + batchSize)

    const { error } = await supabase.from('cards').upsert(batch, {
      onConflict: 'serial',
      ignoreDuplicates: false
    })

    if (error) {
      console.error(`\n   ❌ Error upserting batch ${Math.floor(i / batchSize) + 1}:`, error.message)
      errorCount += batch.length
    } else {
      successCount += batch.length
      process.stdout.write(`\r   ✅ Progress: ${successCount}/${uniqueCards.length} cards`)
    }
  }

  console.log('') // New line after progress
  return { success: successCount, errors: errorCount }
}

async function fetchLibraryCsv(): Promise<string> {
  console.log('📥 Fetching Library from Google Sheets...')

  const response = await fetch(LIBRARY_CSV_URL)

  if (!response.ok) {
    throw new Error(`Failed to fetch Library: ${response.status} ${response.statusText}`)
  }

  return await response.text()
}

async function clearAllCards(): Promise<void> {
  console.log('🗑️  Clearing all existing cards from database...')
  const { error } = await supabase.from('cards').delete().neq('serial', '')
  if (error) {
    throw new Error(`Failed to clear cards: ${error.message}`)
  }
  console.log('   ✅ All cards cleared\n')
}

async function syncCards() {
  const cleanMode = process.argv.includes('--clean')

  console.log('🔄 Starting card sync from Google Sheets...\n')
  if (cleanMode) {
    console.log('⚠️  CLEAN MODE: Will delete all existing cards first\n')
  }
  console.log(`📋 CSV URL: ${LIBRARY_CSV_URL}\n`)

  try {
    // If clean mode, delete all cards first
    if (cleanMode) {
      await clearAllCards()
    }

    const csvContent = await fetchLibraryCsv()
    let cards = parseSheetCsv(csvContent)

    console.log(`📊 Found ${cards.length} cards in Library\n`)

    if (cards.length === 0) {
      console.error('❌ No cards found! Please check the CSV is published correctly.')
      process.exit(1)
    }

    // Convert Google Photos URLs if requested
    const convertPhotos = process.argv.includes('--convert-photos')
    if (convertPhotos) {
      console.log('📸 Converting Google Photos URLs to direct links...')
      console.log('   ⚠️  This may take a while (rate limited to avoid blocking)\n')

      const cardsWithPhotos = cards.filter(
        (c) => c.ron_image_url?.includes('photos.app.goo.gl') || c.ron_image_url?.includes('photos.google.com')
      )
      console.log(`   📷 Found ${cardsWithPhotos.length} cards with Google Photos URLs to convert`)

      let converted = 0
      let failed = 0

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i]
        if (
          card.ron_image_url &&
          (card.ron_image_url.includes('photos.app.goo.gl') || card.ron_image_url.includes('photos.google.com'))
        ) {
          const directUrl = await getDirectPhotoUrl(card.ron_image_url)
          if (directUrl) {
            cards[i] = { ...card, ron_image_url: directUrl }
            converted++
          } else {
            failed++
          }

          // Progress
          if ((converted + failed) % 10 === 0) {
            process.stdout.write(
              `\r   Progress: ${converted + failed}/${cardsWithPhotos.length} (✅ ${converted} / ❌ ${failed})`
            )
          }

          // Rate limit: 200ms between requests
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      console.log(`\n   ✅ Converted: ${converted}`)
      console.log(`   ❌ Failed: ${failed}\n`)
    }

    const { success, errors } = await upsertCards(cards)

    console.log('\n🎉 Sync complete!')
    console.log(`   ✅ Successful: ${success}`)
    console.log(`   ❌ Errors: ${errors}`)

    // Get final count from database
    const { count } = await supabase.from('cards').select('*', { count: 'exact', head: true })
    console.log(`   📊 Total cards in database: ${count}`)
  } catch (error) {
    console.error('❌ Failed to sync:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run the sync
syncCards().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
