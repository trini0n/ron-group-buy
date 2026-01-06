/**
 * Card Sync Script
 * 
 * Syncs cards from the MASTER CSV file to the Supabase database.
 * 
 * Usage:
 *   npm run sync:cards
 * 
 * Environment variables required:
 *   - PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables. Please set:');
  console.error('  - PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Path to the MASTER CSV file
const CSV_PATH = resolve(__dirname, '../Ron/Master Sheet/MASTER Ron\'s Cards List - Holo Library.csv');

interface CsvRow {
  Serial: string;
  Naming: string;
  'Card Name': string;
  'Set Name': string;
  'Retro?': string;
  'Extended?': string;
  'Showcase?': string;
  'Borderless?': string;
  'Etched?': string;
  'Foil?': string;
  Language: string;
  'Flavor Name': string;
  Link: string;
  'Card Type': string;
  Set: string;
  'Collector #': string;
  Color: string;
  'Color Identity': string;
  'Type Line': string;
  'Mana Cost': string;
  'Scryfall ID': string;
  Coding: string;
  'Ron Print': string;
  OOS: string;
  '🆕': string;
}

function parseBoolean(value: string): boolean {
  return value?.toUpperCase() === 'TRUE';
}

function getCardType(serial: string): 'Normal' | 'Holo' | 'Foil' {
  if (serial.startsWith('H-')) return 'Holo';
  if (serial.startsWith('F-')) return 'Foil';
  return 'Normal';
}

async function syncCards() {
  console.log('🔄 Starting card sync...');
  console.log(`📁 Reading CSV from: ${CSV_PATH}`);

  // Read and parse CSV
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`📊 Found ${records.length} cards in CSV`);

  // Transform CSV rows to database records
  const cards = records.map((row) => ({
    serial: row.Serial,
    naming: row.Naming || null,
    card_name: row['Card Name'],
    set_name: row['Set Name'] || null,
    set_code: row.Set || null,
    collector_number: row['Collector #'] || null,
    card_type: getCardType(row.Serial),
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
  }));

  console.log('📤 Upserting cards to database...');

  // Upsert in batches of 100
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('cards')
      .upsert(batch, { 
        onConflict: 'serial',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error(`❌ Error upserting batch ${i / batchSize + 1}:`, error.message);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      process.stdout.write(`\r✅ Progress: ${successCount}/${cards.length} cards`);
    }
  }

  console.log('\n');
  console.log('🎉 Sync complete!');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  // Get final count from database
  const { count } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true });

  console.log(`   📊 Total cards in database: ${count}`);
}

// Run the sync
syncCards().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
