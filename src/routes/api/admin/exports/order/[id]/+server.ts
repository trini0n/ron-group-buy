import { requireAdmin, createAdminClient } from '$lib/server/admin';
import { exportSingleOrder } from '$lib/server/export-builder';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ params, locals }: RequestEvent) {
  // Require admin permission
  await requireAdmin(locals);
  
  const orderId = params.id;
  if (!orderId) {
    throw error(400, 'Order ID is required');
  }
  
  try {
    // Get order number for filename
    const adminClient = createAdminClient();
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      throw error(404, 'Order not found');
    }
    
    // Generate export
    const buffer = await exportSingleOrder(orderId);
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `order_${order.order_number}_${timestamp}.xlsx`;
    
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
    throw error(500, `Failed to export order: ${(err as Error).message}`);
  }
};
