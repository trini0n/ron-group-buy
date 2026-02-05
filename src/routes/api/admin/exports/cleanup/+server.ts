import { cleanupExpiredExports } from '$lib/server/export-storage';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ request }: RequestEvent) {
  // CRON_SECRET is optional - if not set, endpoint is unprotected (development only)
  // Read at runtime to allow tests to set this value
  const cronSecret = process.env.CRON_SECRET || '';
  
  // Verify cron secret to prevent unauthorized access (only if CRON_SECRET is set)
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    
    if (authHeader !== `Bearer ${cronSecret}`) {
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
