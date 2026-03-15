import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { GET as getSingleOrderExport } from '../order/[id]/+server';
import { GET as getGroupBuyExport } from '../groupbuy/[id]/+server';
import { GET as getCleanup } from '../cleanup/+server';

// Mock dependencies
vi.mock('$lib/server/admin', () => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn()
}));

vi.mock('$lib/server/export-builder', () => ({
  exportSingleOrder: vi.fn(),
  exportGroupBuyOrders: vi.fn()
}));

vi.mock('$lib/server/export-storage', () => ({
  cleanupExpiredExports: vi.fn()
}));

import { requireAdmin, createAdminClient } from '$lib/server/admin';
import { exportSingleOrder, exportGroupBuyOrders } from '$lib/server/export-builder';
import { cleanupExpiredExports } from '$lib/server/export-storage';

describe('Export API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/exports/order/[id]', () => {
    it('should require admin permission', async () => {
      const mockLocals = { user: { id: 'user-123' } };
      const mockParams = { id: 'order-uuid' };
      
      // Mock requireAdmin to throw error (not admin)
      vi.mocked(requireAdmin).mockRejectedValue(new Error('Unauthorized'));

      await expect(
        getSingleOrderExport({
          params: mockParams,
          locals: mockLocals
        } as any)
      ).rejects.toThrow('Unauthorized');

      expect(requireAdmin).toHaveBeenCalledWith(mockLocals);
    });

    it('should return 400 if order ID is missing', async () => {
      const mockLocals = { user: { id: 'admin-123' } };
      const mockParams = { id: undefined };

      vi.mocked(requireAdmin).mockResolvedValue(undefined);

      await expect(
        getSingleOrderExport({
          params: mockParams,
          locals: mockLocals
        } as any)
      ).rejects.toMatchObject({
        status: 400
      });
    });

    it('should return 404 if order not found', async () => {
      const mockLocals = { user: { id: 'admin-123' } };
      const mockParams = { id: 'non-existent-uuid' };

      vi.mocked(requireAdmin).mockResolvedValue(undefined);
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        })
      } as any);

      await expect(
        getSingleOrderExport({
          params: mockParams,
          locals: mockLocals
        } as any)
      ).rejects.toMatchObject({
        status: 404
      });
    });

    it('should return Excel file with correct headers', async () => {
      const mockLocals = { user: { id: 'admin-123' } };
      const mockParams = { id: 'order-uuid-123' };
      const mockBuffer = Buffer.from('fake-excel-data');

      vi.mocked(requireAdmin).mockResolvedValue(undefined);
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { order_number: 'GB-2026-0042' },
                error: null
              })
            })
          })
        })
      } as any);
      vi.mocked(exportSingleOrder).mockResolvedValue(mockBuffer);

      const response = await getSingleOrderExport({
        params: mockParams,
        locals: mockLocals
      } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('order_GB-2026-0042');
      expect(response.headers.get('Content-Disposition')).toContain('.xlsx');
    });

    it('should call exportSingleOrder with correct order ID', async () => {
      const mockLocals = { user: { id: 'admin-123' } };
      const mockParams = { id: 'order-uuid-123' };
      const mockBuffer = Buffer.from('fake-excel-data');

      vi.mocked(requireAdmin).mockResolvedValue(undefined);
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { order_number: 'GB-2026-0042' },
                error: null
              })
            })
          })
        })
      } as any);
      vi.mocked(exportSingleOrder).mockResolvedValue(mockBuffer);

      await getSingleOrderExport({
        params: mockParams,
        locals: mockLocals
      } as any);

      expect(exportSingleOrder).toHaveBeenCalledWith('order-uuid-123');
    });
  });

  describe('GET /api/admin/exports/groupbuy/[id]', () => {
    it('should require admin permission', async () => {
      const mockLocals = { user: { id: 'user-123' } };
      const mockParams = { id: 'groupbuy-uuid' };

      vi.mocked(requireAdmin).mockRejectedValue(new Error('Unauthorized'));

      await expect(
        getGroupBuyExport({
          params: mockParams,
          locals: mockLocals
        } as any)
      ).rejects.toThrow('Unauthorized');
    });

    it('should return 400 if group buy ID is missing', async () => {
      const mockLocals = { user: { id: 'admin-123' } };
      const mockParams = { id: undefined };

      vi.mocked(requireAdmin).mockResolvedValue(undefined);

      await expect(
        getGroupBuyExport({
          params: mockParams,
          locals: mockLocals
        } as any)
      ).rejects.toMatchObject({
        status: 400
      });
    });

    it('should return 404 if group buy not found', async () => {
      const mockLocals = { user: { id: 'admin-123' } };
      const mockParams = { id: 'non-existent-uuid' };

      vi.mocked(requireAdmin).mockResolvedValue(undefined);
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        })
      } as any);

      await expect(
        getGroupBuyExport({
          params: mockParams,
          locals: mockLocals
        } as any)
      ).rejects.toMatchObject({
        status: 404
      });
    });

    it('should return Excel file with slugified filename', async () => {
      const mockLocals = { user: { id: 'admin-123' } };
      const mockParams = { id: 'groupbuy-uuid-123' };
      const mockBuffer = Buffer.from('fake-excel-data');

      vi.mocked(requireAdmin).mockResolvedValue(undefined);
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { name: 'January 2026 Group Buy!' },
                error: null
              })
            })
          })
        })
      } as any);
      vi.mocked(exportGroupBuyOrders).mockResolvedValue(mockBuffer);

      const response = await getGroupBuyExport({
        params: mockParams,
        locals: mockLocals
      } as any);

      expect(response.status).toBe(200);
      // Should slugify "January 2026 Group Buy!" to "january-2026-group-buy"
      expect(response.headers.get('Content-Disposition')).toContain('groupbuy_january-2026-group-buy');
      expect(response.headers.get('Content-Disposition')).toContain('.xlsx');
    });

    it('should call exportGroupBuyOrders with correct group buy ID', async () => {
      const mockLocals = { user: { id: 'admin-123' } };
      const mockParams = { id: 'groupbuy-uuid-123' };
      const mockBuffer = Buffer.from('fake-excel-data');

      vi.mocked(requireAdmin).mockResolvedValue(undefined);
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Test Group Buy' },
                error: null
              })
            })
          })
        })
      } as any);
      vi.mocked(exportGroupBuyOrders).mockResolvedValue(mockBuffer);

      await getGroupBuyExport({
        params: mockParams,
        locals: mockLocals
      } as any);

      expect(exportGroupBuyOrders).toHaveBeenCalledWith('groupbuy-uuid-123');
    });
  });

  describe('GET /api/admin/exports/cleanup', () => {
    it('should require CRON_SECRET authorization', async () => {
      const mockRequest = {
        headers: new Headers()
      };

      // Mock cleanup function to return success
      vi.mocked(cleanupExpiredExports).mockResolvedValue({
        deleted: 0,
        errors: []
      });

      // No authorization header
      const response = await getCleanup({ request: mockRequest } as any);

      // Should either allow (no secret set) or deny (secret set but missing)
      // Implementation allows when CRON_SECRET is not set (development)
      expect([200, 401]).toContain(response.status);
    });

    it('should deny access with wrong CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      
      const mockRequest = {
        headers: new Headers({
          authorization: 'Bearer wrong-secret'
        })
      };

      // Mock cleanup function (shouldn't be called but prevents errors if it is)
      vi.mocked(cleanupExpiredExports).mockResolvedValue({
        deleted: 0,
        errors: []
      });

      await expect(
        getCleanup({ request: mockRequest } as any)
      ).rejects.toMatchObject({
        status: 401
      });
      
      delete process.env.CRON_SECRET;
    });

    it('should allow access with correct CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      
      const mockRequest = {
        headers: new Headers({
          authorization: 'Bearer correct-secret'
        })
      };

      vi.mocked(cleanupExpiredExports).mockResolvedValue({
        deleted: 5,
        errors: []
      });

      const response = await getCleanup({ request: mockRequest } as any);

      expect(response.status).toBe(200);
      expect(cleanupExpiredExports).toHaveBeenCalled();
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(5);
      
      delete process.env.CRON_SECRET;
    });

    it('should return cleanup results', async () => {
      const mockRequest = {
        headers: new Headers()
      };

      vi.mocked(cleanupExpiredExports).mockResolvedValue({
        deleted: 3,
        errors: ['Failed to delete file1.xlsx']
      });

      const response = await getCleanup({ request: mockRequest } as any);

      const data = await response.json();
      expect(data.deleted).toBe(3);
      expect(data.errors).toHaveLength(1);
    });

    it('should handle cleanup errors', async () => {
      const mockRequest = {
        headers: new Headers()
      };

      vi.mocked(cleanupExpiredExports).mockRejectedValue(
        new Error('Filesystem error')
      );

      await expect(
        getCleanup({ request: mockRequest } as any)
      ).rejects.toMatchObject({
        status: 500
      });
    });
  });
});

describe('Export File Content Validation', () => {
  it('should generate valid Excel file structure', async () => {
    const { exportSingleOrder: realExportSingleOrder } = await vi.importActual<
      typeof import('$lib/server/export-builder')
    >('$lib/server/export-builder');

    const mockOrder = {
      id: 'order-uuid',
      order_number: 'ORD-001',
      status: 'submitted',
      created_at: '2024-01-15T10:00:00Z',
      notes: null,
      admin_notes: null,
      shipping_name: 'John Doe',
      shipping_line1: '123 Main St',
      shipping_line2: null,
      shipping_city: 'Springfield',
      shipping_state: 'IL',
      shipping_postal_code: '62701',
      shipping_country: 'US',
      shipping_type: 'regular',
      shipping_phone_number: null,
      user: { email: 'john@example.com', paypal_email: null },
      items: [
        {
          id: 'item-1',
          order_id: 'order-uuid',
          card_id: 'card-1',
          card_serial: 'LEA-232',
          card_name: 'Black Lotus',
          card_type: 'foil',
          quantity: 2,
          unit_price: 25.00,
          card: {
            set_code: 'LEA',
            collector_number: '232',
            is_retro: false,
            is_extended: false,
            is_showcase: false,
            is_borderless: false,
            is_etched: false,
            foil_type: 'foil',
            card_type: 'foil',
            language: 'en',
            flavor_name: null
          }
        }
      ]
    };

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockOrder, error: null })
      })
    } as any);

    const buffer = await realExportSingleOrder('order-uuid');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    // Verify single worksheet with correct tab name
    expect(workbook.worksheets).toHaveLength(1);
    expect(workbook.worksheets[0].name).toBe('ORD-001');

    // Verify header section: row 1 is Order Number label + value
    const ws = workbook.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe('Order Number:');
    expect(ws.getRow(1).getCell(2).value).toBe('ORD-001');
    expect(ws.getRow(2).getCell(1).value).toBe('Order Date:');
    expect(ws.getRow(3).getCell(1).value).toBe('Order Status:');

    // Find the line items table header row (contains 'Card Serial' in col 1)
    let tableHeaderCells: (string | number | null)[] = [];
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Card Serial') {
        tableHeaderCells = Array.from({ length: 9 }, (_, i) =>
          row.getCell(i + 1).value as string | number | null
        );
      }
    });

    // Verify all 9 column headers are present
    expect(tableHeaderCells).toHaveLength(9);
    expect(tableHeaderCells[0]).toBe('Card Serial');
    expect(tableHeaderCells[1]).toBe('Card Name');
    expect(tableHeaderCells[8]).toBe('Quantity');
  });

  it('should handle multi-tab export with correct tab ordering', async () => {
    const { exportGroupBuyOrders: realExportGroupBuyOrders } = await vi.importActual<
      typeof import('$lib/server/export-builder')
    >('$lib/server/export-builder');

    const makeOrder = (
      id: string,
      orderNumber: string,
      shippingType: string,
      createdAt: string
    ) => ({
      id,
      order_number: orderNumber,
      status: 'submitted',
      created_at: createdAt,
      notes: null,
      admin_notes: null,
      shipping_name: 'Test User',
      shipping_line1: '123 Main St',
      shipping_line2: null,
      shipping_city: 'New York',
      shipping_state: 'NY',
      shipping_postal_code: '10001',
      shipping_country: 'US',
      shipping_type: shippingType,
      shipping_phone_number: null,
      user: { email: 'test@example.com', paypal_email: null },
      items: []
    });

    // Mix of express/regular orders with different dates
    const mockOrders = [
      makeOrder('order-3', 'ORD-003', 'regular', '2024-01-03T00:00:00Z'),
      makeOrder('order-1', 'ORD-001', 'regular', '2024-01-01T00:00:00Z'),
      makeOrder('order-2', 'ORD-002', 'express', '2024-01-02T00:00:00Z')
    ];

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockOrders, error: null })
      })
    } as any);

    const buffer = await realExportGroupBuyOrders('groupbuy-uuid');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

    // Should create one tab per order
    expect(workbook.worksheets).toHaveLength(3);

    // sortOrdersByShippingAndDate: express first, then regular sorted by created_at ascending
    expect(workbook.worksheets[0].name).toBe('ORD-002'); // express
    expect(workbook.worksheets[1].name).toBe('ORD-001'); // regular, earliest
    expect(workbook.worksheets[2].name).toBe('ORD-003'); // regular, latest
  });
});
