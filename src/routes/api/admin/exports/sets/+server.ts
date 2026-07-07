import { requireAdmin } from '$lib/server/admin'
import { exportAllSets } from '$lib/server/export-builder'
import { error } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import { logger } from '$lib/server/logger'

export async function GET({ locals }: RequestEvent) {
  await requireAdmin(locals)

  try {
    const buffer = await exportAllSets()

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `sets_export_${timestamp}.csv`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': buffer.length.toString()
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    logger.error({ message: msg, stack }, 'Sets export error')
    throw error(500, `Failed to export sets: ${msg}`)
  }
}
