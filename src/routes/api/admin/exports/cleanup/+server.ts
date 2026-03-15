import { cleanupExpiredExports } from '$lib/server/export-storage'
import { error, json } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import { logger } from '$lib/server/logger'

export async function GET({ request }: RequestEvent) {
  // Fail-closed: CRON_SECRET must be configured. Missing secret → 503, wrong token → 401.
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    throw error(503, 'CRON_SECRET not configured')
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    throw error(401, 'Unauthorized')
  }

  try {
    const result = await cleanupExpiredExports()
    return json({
      success: true,
      deleted: result.deleted,
      errors: result.errors
    })
  } catch (err) {
    logger.error({ error: err }, 'Cleanup error')
    throw error(500, `Cleanup failed: ${(err as Error).message}`)
  }
}
