import { createAdminClient } from './src/lib/server/admin.js';
import { exportSingleOrder } from './src/lib/server/export-builder.js';
import fs from 'fs/promises';

async function testExport() {
  const adminClient = createAdminClient();
  const { data: order, error } = await adminClient.from('orders').select('id').limit(1).single();
  
  if (error || !order) {
    console.log('No orders found to export or error:', error);
    return;
  }
  
  try {
    const buffer = await exportSingleOrder(order.id);
    await fs.writeFile('test_export.xlsx', buffer);
    console.log('Export generated successfully, size:', buffer.length);
  } catch (e) {
    console.error('Export failed:', e);
  }
}

testExport();
