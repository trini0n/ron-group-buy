import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, requireAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

interface AssociateResult {
  added: number
  already_present: number
  errors: Array<{ line: string; reason: string }>
}

// POST /api/admin/sets/[setCode]/cards
// Body: { lines: string[] }  — each line is "setCode coll# [lang]"
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

  // Verify the set exists — use any cast since 'sets' not in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: setRow } = await (adminClient as any)
    .from('sets')
    .select('set_code')
    .eq('set_code', params.setCode)
    .single()
  if (!setRow) throw error(404, 'Set not found')

  // Parse each line: "setCode coll# lang" — lang optional, defaults to 'en'
  interface ParsedLine {
    original: string
    set_code: string
    collector_number: string
    language: string
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
    parsed.push({
      original: line,
      set_code: parts[0]!.toUpperCase(),
      collector_number: parts[1]!,
      language: (parts[2] ?? 'en').toLowerCase()
    })
  }

  if (parsed.length === 0) {
    return json({ added: 0, already_present: 0, errors: parseErrors } satisfies AssociateResult)
  }

  // Batch query cards matching any of the parsed (set_code, collector_number) combos
  const uniqueSetCodes = [...new Set(parsed.map((p) => p.set_code))]
  const uniqueCollNums = [...new Set(parsed.map((p) => p.collector_number))]

  const { data: candidates, error: dbError } = await adminClient
    .from('cards')
    .select('id, set_code, collector_number, language')
    .in('set_code', uniqueSetCodes)
    .in('collector_number', uniqueCollNums)

  if (dbError) {
    logger.error({ error: dbError }, 'Error fetching card candidates for set association')
    throw error(500, 'Database error resolving cards')
  }

  // Build lookup: "SET|collNum|lang" -> card id[]
  const lookup = new Map<string, string[]>()
  for (const card of candidates ?? []) {
    const key = `${(card.set_code ?? '').toUpperCase()}|${card.collector_number ?? ''}|${(card.language ?? 'en').toLowerCase()}`
    const existing = lookup.get(key) ?? []
    existing.push(card.id)
    lookup.set(key, existing)
  }

  // Resolve each parsed line to card IDs
  const resolveErrors: Array<{ line: string; reason: string }> = []
  const cardIds: string[] = []

  for (const p of parsed) {
    const key = `${p.set_code}|${p.collector_number}|${p.language}`
    const ids = lookup.get(key)
    if (!ids || ids.length === 0) {
      resolveErrors.push({ line: p.original, reason: 'No matching card found in library' })
    } else {
      cardIds.push(...ids)
    }
  }

  const allErrors = [...parseErrors, ...resolveErrors]

  if (cardIds.length === 0) {
    return json({ added: 0, already_present: 0, errors: allErrors } satisfies AssociateResult)
  }

  // Deduplicate card IDs
  const uniqueCardIds = [...new Set(cardIds)]

  // Upsert into set_cards — ignoreDuplicates silently skips already-associated cards (ASSOC-05)
  const inserts = uniqueCardIds.map((card_id) => ({ set_code: params.setCode, card_id }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertError } = await (adminClient as any)
    .from('set_cards')
    .upsert(inserts, { onConflict: 'set_code,card_id', ignoreDuplicates: true })
    .select('id')

  if (insertError) {
    logger.error({ error: insertError }, 'Error inserting set_cards')
    throw error(500, 'Failed to associate cards with set')
  }

  const added = (inserted as { id: string }[] | null)?.length ?? 0
  const already_present = uniqueCardIds.length - added

  return json({ added, already_present, errors: allErrors } satisfies AssociateResult)
}
