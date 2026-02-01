import { cleanupExpiredExports } from '$lib/server/export-storage';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

// CRON_SECRET is optional - if not set, endpoint is unprotected (development only)
const CRON_SECRET = process.env.CRON_SECRET || '';

export async function GET({ request }: RequestEvent) {
  // Verify cron secret to prevent unauthorized access (only if CRON_SECRET is set)
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      throw error(401, 'Unauthorized');
    }
  }
  
  try {
    const result = await cleanupExpiredExports();
    return json({
      success: true,
      deleted: result.deleted,
      errors: result.errors
    });
  } catch (err) {
    console.error('Cleanup error:', err);
    throw error(500, `Cleanup failed: ${(err as Error).message}`);
  }
};
