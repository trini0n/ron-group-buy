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
    const filename = `sets_export_${timestamp}.xlsx`

    return new Response(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Length': buffer.length.toString()
      }
    })
  } catch (err) {
    logger.error({ error: err }, 'Sets export error')
    throw error(500, `Failed to export sets: ${(err as Error).message}`)
  }
}
