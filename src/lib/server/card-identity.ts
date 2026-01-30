// Card Identity Service
// Handles card identity generation, matching, and duplicate detection during sync

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Card identity fields used for matching across inventory resyncs
 * Priority: (set_code, collector_number, card_name, is_foil, is_etched, language)
 * Fallback: (set_code, card_name, is_foil, language) when collector_number is missing
 */
export interface CardIdentity {
  set_code: string | null
  collector_number: string | null
  card_name: string
  is_foil: boolean
  is_etched: boolean
  language: string
}

/**
 * Represents a card in the database with identity fields
 */
export interface CardWithIdentity {
  id: string
  serial: string
  card_name: string
  set_code: string | null
  collector_number: string | null
  is_foil: boolean
  is_etched: boolean
  language: string
  is_in_stock: boolean
  card_type?: string
}

/**
 * Result of duplicate detection during sync
 */
export interface DuplicateGroup {
  identityKey: string
  cards: CardWithIdentity[]
  keptSerial: string
  markedOosSerials: string[]
}

/**
 * Generate a normalized identity key for a card
 * Format: set_code|collector_number|card_name|is_foil|is_etched|language
 * 
 * Rules:
 * - All text fields are trimmed and lowercased
 * - Boolean fields are converted to "true" or "false"
 * - null collector_number becomes empty string in key
 */
export function generateCardIdentityKey(identity: CardIdentity): string {
  const normalize = (str: string | null): string => {
    if (str === null || str === undefined) return ''
    return str.trim().toLowerCase()
  }

  const setCode = normalize(identity.set_code)
  const collectorNumber = normalize(identity.collector_number)
  const cardName = normalize(identity.card_name)
  const isFoil = identity.is_foil ? 'true' : 'false'
  const isEtched = identity.is_etched ? 'true' : 'false'
  const language = normalize(identity.language) || 'en'

  return `${setCode}|${collectorNumber}|${cardName}|${isFoil}|${isEtched}|${language}`
}

/**
 * Extract card identity from a card object
 */
export function extractCardIdentity(card: Partial<CardWithIdentity>): CardIdentity {
  return {
    set_code: card.set_code || null,
    collector_number: card.collector_number || null,
    card_name: card.card_name || '',
    is_foil: card.is_foil || false,
    is_etched: card.is_etched || false,
    language: card.language || 'en'
  }
}

/**
 * Check if two cards have the same identity
 */
export function isSameIdentity(card1: CardIdentity, card2: CardIdentity): boolean {
  return generateCardIdentityKey(card1) === generateCardIdentityKey(card2)
}

/**
 * Extract numeric portion from a serial number for comparison
 * Handles formats like "H-123", "N-9", "F-2233"
 * 
 * @param serial - Serial number string
 * @returns Numeric portion, or 0 if not found
 */
function extractSerialNumber(serial: string): number {
  const match = serial.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Compare two serial numbers numerically
 * First compares the prefix (letter), then the numeric portion
 * 
 * @param a - First serial
 * @param b - Second serial
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
function compareSerials(a: string, b: string): number {
  // Extract prefix (e.g., "H", "N", "F")
  const prefixA = a.match(/^([A-Za-z]+)-/)?.[1] || ''
  const prefixB = b.match(/^([A-Za-z]+)-/)?.[1] || ''

  // First compare by prefix
  if (prefixA !== prefixB) {
    return prefixA.localeCompare(prefixB)
  }

  // Then compare by numeric portion
  const numA = extractSerialNumber(a)
  const numB = extractSerialNumber(b)

  return numA - numB
}

/**
 * Detect duplicate card identities within a batch of cards
 * 
 * @param cards - Array of cards to check for duplicates
 * @returns Array of duplicate groups with serials to keep and mark OOS
 */
export function detectDuplicatesInBatch(cards: CardWithIdentity[]): DuplicateGroup[] {
  // Group cards by identity key
  const identityMap = new Map<string, CardWithIdentity[]>()

  for (const card of cards) {
    const identity = extractCardIdentity(card)
    const key = generateCardIdentityKey(identity)

    if (!identityMap.has(key)) {
      identityMap.set(key, [])
    }
    identityMap.get(key)!.push(card)
  }

  // Find groups with duplicates (more than 1 card)
  const duplicates: DuplicateGroup[] = []

  for (const [identityKey, group] of identityMap.entries()) {
    if (group.length > 1) {
      // Sort by serial number (descending) to keep the highest
      // Use numeric comparison, not string comparison
      const sorted = [...group].sort((a, b) => compareSerials(b.serial, a.serial))

      const kept = sorted[0]
      const markedOos = sorted.slice(1)

      duplicates.push({
        identityKey,
        cards: group,
        keptSerial: kept.serial,
        markedOosSerials: markedOos.map((c) => c.serial)
      })
    }
  }

  return duplicates
}

/**
 * Resolve duplicates by keeping the highest serial and marking others as out of stock
 * Returns array of alerts to be logged
 */
export async function resolveDuplicates(
  supabase: SupabaseClient,
  duplicateGroups: DuplicateGroup[]
): Promise<{
  alertsCreated: number
  cardsMarkedOos: number
  errors: string[]
}> {
  let alertsCreated = 0
  let cardsMarkedOos = 0
  const errors: string[] = []

  for (const group of duplicateGroups) {
    try {
      // Mark lower serials as out of stock
      if (group.markedOosSerials.length > 0) {
        const { error: updateError } = await supabase
          .from('cards')
          .update({ is_in_stock: false })
          .in('serial', group.markedOosSerials)

        if (updateError) {
          errors.push(`Failed to mark serials OOS: ${group.markedOosSerials.join(', ')}`)
          console.error('Error marking cards OOS:', updateError)
          continue
        }

        cardsMarkedOos += group.markedOosSerials.length
      }

      // Create alert record
      const firstCard = group.cards[0]
      const { error: alertError } = await supabase
        .from('sync_duplicate_alerts')
        .insert({
          card_identity_key: group.identityKey,
          card_name: firstCard.card_name,
          set_code: firstCard.set_code,
          collector_number: firstCard.collector_number,
          duplicate_serials: group.cards.map(c => c.serial),
          kept_serial: group.keptSerial,
          marked_oos_serials: group.markedOosSerials
        })

      if (alertError) {
        errors.push(`Failed to create alert for: ${group.identityKey}`)
        console.error('Error creating alert:', alertError)
        continue
      }

      alertsCreated++
    } catch (err) {
      errors.push(`Exception resolving duplicates for: ${group.identityKey}`)
      console.error('Exception in resolveDuplicates:', err)
    }
  }

  return { alertsCreated, cardsMarkedOos, errors }
}

/**
 * Find cards in current inventory that match the given identity
 * Returns cards sorted by serial number (highest first)
 */
export async function findCardsByIdentity(
  supabase: SupabaseClient,
  identity: CardIdentity
): Promise<CardWithIdentity[]> {
  // Build query based on whether collector_number exists
  let query = supabase
    .from('cards')
    .select('id, serial, card_name, set_code, collector_number, is_foil, is_etched, language, is_in_stock')
    .eq('card_name', identity.card_name)
    .eq('is_foil', identity.is_foil)
    .eq('is_etched', identity.is_etched)
    .eq('language', identity.language)
    .eq('is_in_stock', true)

  if (identity.set_code) {
    query = query.eq('set_code', identity.set_code)
  }

  if (identity.collector_number) {
    query = query.eq('collector_number', identity.collector_number)
  } else {
    // Fallback: only match cards that also have null collector_number
    query = query.is('collector_number', null)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error finding cards by identity:', error)
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

  // Sort by serial number (highest first) using numeric comparison
  return data.sort((a, b) => compareSerials(b.serial, a.serial))
}

/**
 * Find a single best match card by identity
 * Returns the card with the highest serial number
 */
export async function findBestMatchByIdentity(
  supabase: SupabaseClient,
  identity: CardIdentity
): Promise<CardWithIdentity | null> {
  const matches = await findCardsByIdentity(supabase, identity)
  return matches.length > 0 ? matches[0] : null
}
