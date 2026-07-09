// Card Identity Service
// Handles card identity generation, matching, and duplicate detection during sync

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '$lib/server/logger'

/**
 * Card identity fields used for matching across inventory resyncs
 * Priority: (set_code, collector_number, card_name, card_type, is_foil, is_etched, language, is_misprint)
 * Fallback: (set_code, card_name, card_type, is_foil, language, is_misprint) when collector_number is missing
 *
 * card_type ('Normal' | 'Holo' | 'Foil') is included so that a Holo and a Foil
 * variant of the same card are never treated as duplicates of each other.
 *
 * is_misprint is included so that a misprint and a non-misprint version of the
 * same card are never treated as duplicates of each other.
 */
export interface CardIdentity {
  set_code: string | null
  collector_number: string | null
  card_name: string
  card_type: string
  is_foil: boolean
  is_etched: boolean
  language: string
  is_misprint: boolean
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
  card_type: string
  is_foil: boolean
  is_etched: boolean
  language: string
  is_in_stock: boolean
  is_misprint: boolean
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
 * Format: set_code|collector_number|card_name|card_type|is_foil|is_etched|language|is_misprint
 *
 * Rules:
 * - All text fields are trimmed and lowercased
 * - Boolean fields are converted to "true" or "false"
 * - null collector_number becomes empty string in key
 * - card_type distinguishes 'Normal' / 'Holo' / 'Foil' so that a Holo and a Foil
 *   variant of the same card are never collapsed into the same identity.
 * - is_misprint is included so that a misprint and a non-misprint of the same card
 *   are never collapsed into the same identity.
 */
export function generateCardIdentityKey(identity: CardIdentity): string {
  const normalize = (str: string | null): string => {
    if (str === null || str === undefined) return ''
    return str.trim().toLowerCase()
  }

  const setCode = normalize(identity.set_code)
  const collectorNumber = normalize(identity.collector_number)
  const cardName = normalize(identity.card_name)
  const cardType = normalize(identity.card_type) || 'normal'
  const isFoil = identity.is_foil ? 'true' : 'false'
  const isEtched = identity.is_etched ? 'true' : 'false'
  const language = normalize(identity.language) || 'en'
  const isMisprint = identity.is_misprint ? 'true' : 'false'

  return `${setCode}|${collectorNumber}|${cardName}|${cardType}|${isFoil}|${isEtched}|${language}|${isMisprint}`
}

/**
 * Extract card identity from a card object
 */
export function extractCardIdentity(card: Partial<CardWithIdentity>): CardIdentity {
  return {
    set_code: card.set_code || null,
    collector_number: card.collector_number || null,
    card_name: card.card_name || '',
    card_type: card.card_type || 'Normal',
    is_foil: card.is_foil || false,
    is_etched: card.is_etched || false,
    language: card.language || 'en',
    is_misprint: card.is_misprint || false
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
  return match ? parseInt(match[1]!, 10) : 0
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
      if (!kept) continue // Safety check, should not happen
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
          logger.error({ error: updateError, serials: group.markedOosSerials }, 'Error marking cards OOS')
          continue
        }

        cardsMarkedOos += group.markedOosSerials.length
      }

      // Create alert record
      const firstCard = group.cards[0]
      if (!firstCard) continue // Safety check
      const { error: alertError } = await supabase.from('sync_duplicate_alerts').insert({
        card_identity_key: group.identityKey,
        card_name: firstCard.card_name,
        set_code: firstCard.set_code,
        collector_number: firstCard.collector_number,
        duplicate_serials: group.cards.map((c) => c.serial),
        kept_serial: group.keptSerial,
        marked_oos_serials: group.markedOosSerials
      })

      if (alertError) {
        errors.push(`Failed to create alert for: ${group.identityKey}`)
        logger.error({ error: alertError, identityKey: group.identityKey }, 'Error creating alert')
        continue
      }

      alertsCreated++
    } catch (err) {
      errors.push(`Exception resolving duplicates for: ${group.identityKey}`)
      logger.error({ error: err, identityKey: group.identityKey }, 'Exception in resolveDuplicates')
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
    .select('id, serial, card_name, set_code, collector_number, card_type, is_foil, is_etched, language, is_in_stock')
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
  }
  // When collector_number is absent, don't constrain it — set_code + card_name + foil
  // fields are sufficient to match. Requiring IS NULL would block cards that acquired
  // a collector_number after a Scryfall resync (the original order pre-dates the resync).

  const { data, error } = await query

  if (error) {
    logger.error({ error, identity }, 'Error finding cards by identity')
    return []
  }

  if (!data || data.length === 0) {
    // Secondary lookup without is_in_stock filter to distinguish OOS vs not-in-DB
    let secondaryQuery = supabase
      .from('cards')
      .select('id, serial, is_in_stock, set_code, collector_number')
      .eq('card_name', identity.card_name)
      .eq('is_foil', identity.is_foil)
      .eq('is_etched', identity.is_etched)
      .eq('language', identity.language)

    if (identity.set_code) {
      secondaryQuery = secondaryQuery.eq('set_code', identity.set_code)
    }
    if (identity.collector_number) {
      secondaryQuery = secondaryQuery.eq('collector_number', identity.collector_number)
    }

    const { data: anyData } = await secondaryQuery

    if (anyData && anyData.length > 0) {
      logger.warn(
        {
          card_name: identity.card_name,
          set_code: identity.set_code,
          collector_number: identity.collector_number,
          is_foil: identity.is_foil,
          is_etched: identity.is_etched,
          language: identity.language,
          oos_serials: anyData.map((c) => c.serial)
        },
        '[findCardsByIdentity] card exists in DB but is marked OOS (is_in_stock=false) — check OOS column in spreadsheet'
      )
    } else {
      // Tertiary lookup: search only by card_name to find any DB record regardless of set/collector
      const { data: nameOnlyData } = await supabase
        .from('cards')
        .select('id, serial, is_in_stock, set_code, collector_number, language')
        .eq('card_name', identity.card_name)
        .eq('is_foil', identity.is_foil)
        .eq('is_etched', identity.is_etched)
        .limit(5)

      if (nameOnlyData && nameOnlyData.length > 0) {
        logger.warn(
          {
            card_name: identity.card_name,
            order_identity: {
              set_code: identity.set_code,
              collector_number: identity.collector_number,
              language: identity.language
            },
            db_records: nameOnlyData.map((c) => ({
              serial: c.serial,
              set_code: c.set_code,
              collector_number: c.collector_number,
              language: c.language,
              is_in_stock: c.is_in_stock
            }))
          },
          '[findCardsByIdentity] card exists in DB but with DIFFERENT set_code/collector_number — order identity mismatch'
        )
      } else {
        logger.warn(
          {
            card_name: identity.card_name,
            set_code: identity.set_code,
            collector_number: identity.collector_number,
            is_foil: identity.is_foil,
            is_etched: identity.is_etched,
            language: identity.language
          },
          '[findCardsByIdentity] card NOT in DB at all (no record with this name+foil combination)'
        )
      }
    }
    return []
  }

  logger.info(
    {
      card_name: identity.card_name,
      matches: data.map((c) => ({
        id: c.id,
        serial: c.serial,
        set_code: c.set_code,
        collector_number: c.collector_number,
        is_foil: c.is_foil,
        is_etched: c.is_etched,
        language: c.language,
        is_in_stock: c.is_in_stock
      }))
    },
    '[findCardsByIdentity] matches found'
  )

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
  return matches[0] ?? null
}
