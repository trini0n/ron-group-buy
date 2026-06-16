import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, requireAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'
import { FOIL_SUBTYPES } from '$lib/utils'

interface AssociateResult {
  added: number
  already_present: number
  errors: Array<{ line: string; reason: string }>
}

// All valid finish values (case-insensitive aliases accepted in input)
// Canonical values match card_type column exactly.
const FINISH_ALIASES: Record<string, string> = {
  normal: 'Normal',
  holo: 'Holo',
  foil: 'Foil',
  galaxyfoil: 'Galaxy Foil',
  'galaxy foil': 'Galaxy Foil',
  galaxy: 'Galaxy Foil',
  raisedfoil: 'Raised Foil',
  'raised foil': 'Raised Foil',
  raised: 'Raised Foil',
  surgefoil: 'Surge Foil',
  'surge foil': 'Surge Foil',
  surge: 'Surge Foil'
}

function resolveFinish(raw: string): string | null {
  return FINISH_ALIASES[raw.toLowerCase()] ?? null
}

// POST /api/admin/sets/[setCode]/cards
// Body: { lines: string[] }
// Line format: "setCode coll# [lang] [finish]"
//   lang defaults to 'en', finish defaults to ALL types (any matching card is added)
//   finish examples: Normal, Holo, Foil, Galaxy, Raised, Surge (case-insensitive)
export const POST: RequestHandler = async ({ request, locals, params }) => {
  await requireAdmin(locals)
  const adminClient = createAdminClient()

  let body: { lines: string[] }
  try {
    body = await request.json()
  } catch {
    throw error(400, 'Invalid JSON')
  }

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    throw error(400, 'lines must be a non-empty array of strings')
  }
  if (body.lines.length > 2000) {
    throw error(400, 'Maximum 2000 lines per request')
  }

  // Verify the set exists
  const { data: setRow } = await adminClient
    .from('sets')
    .select('set_code')
    .eq('set_code', params.setCode)
    .single()
  if (!setRow) throw error(404, 'Set not found')

  // Parse each line: "setCode coll# [lang] [finish]"
  // Token 3 = lang (2-letter code like 'en', 'ja', 'de') OR a finish keyword
  // Token 4 = finish (if token 3 was lang)
  // Heuristic: if token 3 looks like a finish keyword, treat it as finish (lang = 'en')
  interface ParsedLine {
    original: string
    set_code: string
    collector_number: string
    language: string
    finish: string | null // null = match any finish
  }

  const parsed: ParsedLine[] = []
  const parseErrors: Array<{ line: string; reason: string }> = []

  for (const rawLine of body.lines) {
    const line = rawLine.trim()
    if (!line) continue
    const parts = line.split(/\s+/)
    if (parts.length < 2) {
      parseErrors.push({ line, reason: 'Expected at least "setCode collectorNumber"' })
      continue
    }

    const token3 = parts[2]
    const token4 = parts[3]

    let language = 'en'
    let finish: string | null = null

    if (token3) {
      // If token3 matches a finish keyword, treat it as finish (no lang specified)
      const asFinish = resolveFinish(token3)
      if (asFinish) {
        finish = asFinish
      } else {
        // Treat as language code
        language = token3.toLowerCase()
        if (token4) {
          const f = resolveFinish(token4)
          if (f) {
            finish = f
          } else {
            parseErrors.push({
              line,
              reason: `Unknown finish "${token4}". Valid: Normal, Holo, Foil, Galaxy, Raised, Surge`
            })
            continue
          }
        }
      }
    }

    parsed.push({
      original: line,
      set_code: parts[0]!.toUpperCase(),
      collector_number: parts[1]!,
      language,
      finish
    })
  }

  if (parsed.length === 0) {
    return json({ added: 0, already_present: 0, errors: parseErrors } satisfies AssociateResult)
  }

  // Batch query cards — fetch card_type too for finish filtering
  const uniqueSetCodes = [...new Set(parsed.map((p) => p.set_code))]
  const uniqueCollNums = [...new Set(parsed.map((p) => p.collector_number))]

  const { data: candidates, error: dbError } = await adminClient
    .from('cards')
    .select('id, set_code, collector_number, language, card_type, serial')
    .in('set_code', uniqueSetCodes)
    .in('collector_number', uniqueCollNums)

  if (dbError) {
    logger.error({ error: dbError }, 'Error fetching card candidates for set association')
    throw error(500, 'Database error resolving cards')
  }

  // Deduplicate candidates: for each exact (set_code|collector_number|language|card_type)
  // group, keep only the card with the highest serial number.
  // "Highest serial" = largest numeric value; non-numeric serials sort lexicographically
  // after numeric ones are compared, so pure-numeric serials always win over nulls.
  const bestByKey = new Map<string, { id: string; serial: string | null }>()

  for (const card of candidates ?? []) {
    const sc = (card.set_code ?? '').toUpperCase()
    const cn = card.collector_number ?? ''
    const lang = (card.language ?? 'en').toLowerCase()
    const ct = card.card_type ?? ''
    const exactKey = `${sc}|${cn}|${lang}|${ct}`

    const existing = bestByKey.get(exactKey)
    if (!existing) {
      bestByKey.set(exactKey, { id: card.id, serial: card.serial ?? null })
    } else {
      // Compare serials: prefer the higher value.
      // Parse as numbers first; if both numeric, compare numerically.
      // Otherwise fall back to string comparison (higher string = kept).
      const existingSerial = existing.serial ?? ''
      const newSerial = card.serial ?? ''
      const existingNum = parseFloat(existingSerial)
      const newNum = parseFloat(newSerial)
      const newIsHigher =
        !isNaN(existingNum) && !isNaN(newNum)
          ? newNum > existingNum
          : newSerial > existingSerial
      if (newIsHigher) {
        bestByKey.set(exactKey, { id: card.id, serial: newSerial })
      }
    }
  }

  // Build lookup using only the winning (highest-serial) card per exact key.
  // Wildcard and foil-family keys are derived from these winners only.
  const lookup = new Map<string, string[]>()
  const foilSubtypes = FOIL_SUBTYPES as readonly string[]

  for (const [exactKey, winner] of bestByKey) {
    const [sc, cn, lang, ct] = exactKey.split('|')

    // Exact finish key → single winner
    const exactList = lookup.get(exactKey) ?? []
    exactList.push(winner.id)
    lookup.set(exactKey, exactList)

    // Wildcard key (no finish specified)
    const wildcardKey = `${sc}|${cn}|${lang}|*`
    const wildcardList = lookup.get(wildcardKey) ?? []
    wildcardList.push(winner.id)
    lookup.set(wildcardKey, wildcardList)

    // Foil-family key ("Foil" input matches all foil subtypes)
    if (foilSubtypes.includes(ct!)) {
      const familyKey = `${sc}|${cn}|${lang}|Foil-family`
      const familyList = lookup.get(familyKey) ?? []
      familyList.push(winner.id)
      lookup.set(familyKey, familyList)
    }
  }

  // Resolve each parsed line to card IDs
  const resolveErrors: Array<{ line: string; reason: string }> = []
  const cardIds: string[] = []

  for (const p of parsed) {
    const sc = p.set_code
    const cn = p.collector_number
    const lang = p.language

    let ids: string[] | undefined

    if (!p.finish) {
      // No finish specified — match all finish types
      ids = lookup.get(`${sc}|${cn}|${lang}|*`)
    } else if (p.finish === 'Foil') {
      // "Foil" matches all foil subtypes (Foil, Galaxy Foil, Raised Foil, Surge Foil)
      ids = lookup.get(`${sc}|${cn}|${lang}|Foil-family`)
    } else {
      // Exact finish match (Normal, Holo, or specific foil subtype)
      ids = lookup.get(`${sc}|${cn}|${lang}|${p.finish}`)
    }

    if (!ids || ids.length === 0) {
      const finishHint = p.finish ? ` with finish "${p.finish}"` : ''
      resolveErrors.push({
        line: p.original,
        reason: `No matching card found in library${finishHint}`
      })
    } else {
      cardIds.push(...ids) // duplicates intentionally kept
    }
  }

  const allErrors = [...parseErrors, ...resolveErrors]

  if (cardIds.length === 0) {
    return json({ added: 0, already_present: 0, errors: allErrors } satisfies AssociateResult)
  }

  // The unique constraint on (set_code, card_id) was dropped to allow multiple
  // copies of the same card in a set (migration 20260615000001).
  // Deduplicate within this batch only — same card line submitted twice in one
  // request inserts one row, not two.
  const uniqueCardIds = [...new Set(cardIds)]
  const inserts = uniqueCardIds.map((card_id) => ({ set_code: params.setCode, card_id }))
  const { data: inserted, error: insertError } = await adminClient
    .from('set_cards')
    .insert(inserts)
    .select('id')

  if (insertError) {
    logger.error({ error: insertError }, `Error inserting set_cards: ${insertError.message}`)
    throw error(500, `Failed to associate cards with set: ${insertError.message}`)
  }

  const added = inserted?.length ?? 0

  return json({ added, already_present: 0, errors: allErrors } satisfies AssociateResult)
}
