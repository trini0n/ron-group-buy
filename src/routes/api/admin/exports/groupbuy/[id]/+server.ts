import { requireAdmin, createAdminClient } from '$lib/server/admin';
import { exportGroupBuyOrders } from '$lib/server/export-builder';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Slugify a string for use in filenames
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function GET({ params, locals }: RequestEvent) {
  // Require admin permission
  await requireAdmin(locals);
  
  const groupBuyId = params.id;
  if (!groupBuyId) {
    throw error(400, 'Group buy ID is required');
  }
  
  // Get group buy name for filename
  const adminClient = createAdminClient();
  const { data: groupBuy, error: groupBuyError } = await adminClient
    .from('group_buy_config')
    .select('name')
    .eq('id', groupBuyId)
    .single();
  
  if (groupBuyError || !groupBuy) {
    throw error(404, 'Group buy not found');
  }
  
  try {
    // Generate export
    const buffer = await exportGroupBuyOrders(groupBuyId);
    
    // Create filename with slugified group buy name and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const slugifiedName = slugify(groupBuy.name);
    const filename = `groupbuy_${slugifiedName}_${timestamp}.xlsx`;
    
    // Return file as download
    return new Response(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (err) {
    console.error('Export error:', err);
    throw error(500, `Failed to export group buy: ${(err as Error).message}`);
  }
};
