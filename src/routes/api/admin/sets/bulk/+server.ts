import type { RequestHandler } from './$types'
import { json, error } from '@sveltejs/kit'
import { createAdminClient, requireAdmin } from '$lib/server/admin'
import { logger } from '$lib/server/logger'

interface BulkUpsertResult {
  created: number
  updated: number
  errors: Array<{ line: string; reason: string }>
}

// POST /api/admin/sets/bulk
// Body: { lines: string[] } — each line is tab-separated: "setCode\tsetName\tprice"
// price is optional (can be empty or omitted)
export const POST: RequestHandler = async ({ request, locals }) => {
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
  if (body.lines.length > 500) {
    throw error(400, 'Maximum 500 sets per bulk import')
  }

  interface ParsedSet {
    set_code: string
    set_name: string
    price: number | null
  }

  const parsed: ParsedSet[] = []
  const parseErrors: Array<{ line: string; reason: string }> = []

  for (const rawLine of body.lines) {
    const line = rawLine.trim()
    if (!line) continue

    const parts = line.split('\t')
    if (parts.length < 2) {
      parseErrors.push({ line, reason: 'Expected at least "setCode TAB setName"' })
      continue
    }

    const set_code = parts[0]!.trim().toUpperCase()
    const set_name = parts[1]!.trim()
    const rawPrice = parts[2]?.trim()

    if (!set_code) {
      parseErrors.push({ line, reason: 'set_code cannot be empty' })
      continue
    }
    if (!set_name) {
      parseErrors.push({ line, reason: 'set_name cannot be empty' })
      continue
    }

    let price: number | null = null
    if (rawPrice) {
      // Strip currency symbols and whitespace (e.g. "$65", "65$", "65.00")
      const cleaned = rawPrice.replace(/[^0-9.]/g, '')
      const parsed_price = parseFloat(cleaned)
      if (isNaN(parsed_price) || parsed_price < 0) {
        parseErrors.push({ line, reason: `Invalid price "${rawPrice}" — use a number like 65 or 65.00` })
        continue
      }
      price = parsed_price
    }

    parsed.push({ set_code, set_name, price })
  }

  if (parsed.length === 0) {
    return json({ created: 0, updated: 0, errors: parseErrors } satisfies BulkUpsertResult)
  }

  // Fetch existing set_codes to distinguish creates vs updates
  const incomingCodes = parsed.map((p) => p.set_code)
  const { data: existing } = await adminClient
    .from('sets')
    .select('set_code')
    .in('set_code', incomingCodes)

  const existingCodes = new Set((existing ?? []).map((s) => s.set_code))

  const toCreate = parsed.filter((p) => !existingCodes.has(p.set_code))
  const toUpdate = parsed.filter((p) => existingCodes.has(p.set_code))

  let created = 0
  let updated = 0
  const dbErrors: Array<{ line: string; reason: string }> = []

  // Bulk insert new sets
  if (toCreate.length > 0) {
    const { error: insertError } = await adminClient
      .from('sets')
      .insert(toCreate.map((p) => ({ set_code: p.set_code, set_name: p.set_name, price: p.price })))
    if (insertError) {
      logger.error({ error: insertError }, 'Error bulk inserting sets')
      // Fall back to per-row to identify which ones failed
      for (const p of toCreate) {
        const { error: rowError } = await adminClient
          .from('sets')
          .insert({ set_code: p.set_code, set_name: p.set_name, price: p.price })
        if (rowError) {
          dbErrors.push({ line: `${p.set_code}\t${p.set_name}`, reason: rowError.message })
        } else {
          created++
        }
      }
    } else {
      created = toCreate.length
    }
  }

  // Update existing sets one by one (Supabase doesn't support bulk update with different values per row)
  for (const p of toUpdate) {
    const updates: Record<string, unknown> = { set_name: p.set_name }
    if (p.price !== null) updates.price = p.price
    const { error: updateError } = await adminClient
      .from('sets')
      .update(updates)
      .eq('set_code', p.set_code)
    if (updateError) {
      logger.error({ error: updateError, set_code: p.set_code }, 'Error updating set in bulk upsert')
      dbErrors.push({ line: `${p.set_code}\t${p.set_name}`, reason: updateError.message })
    } else {
      updated++
    }
  }

  const allErrors = [...parseErrors, ...dbErrors]
  return json({ created, updated, errors: allErrors } satisfies BulkUpsertResult)
}
