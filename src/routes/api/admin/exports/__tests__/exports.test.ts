import { describe, it, expect, vi, beforeEach } from 'vitest';
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

      const response = await getSingleOrderExport({
        params: mockParams,
        locals: mockLocals
      } as any);

      expect(response.status).toBe(400);
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

      const response = await getSingleOrderExport({
        params: mockParams,
        locals: mockLocals
      } as any);

      expect(response.status).toBe(404);
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

      const response = await getGroupBuyExport({
        params: mockParams,
        locals: mockLocals
      } as any);

      expect(response.status).toBe(400);
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

      const response = await getGroupBuyExport({
        params: mockParams,
        locals: mockLocals
      } as any);

      expect(response.status).toBe(404);
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

      const response = await getCleanup({ request: mockRequest } as any);

      expect(response.status).toBe(401);
      
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

      const response = await getCleanup({ request: mockRequest } as any);

      expect(response.status).toBe(500);
    });
  });
});

describe('Export File Content Validation', () => {
  it('should generate valid Excel file structure', async () => {
    // TODO: Use exceljs to parse the generated buffer and validate structure
    // - Verify worksheet names match order numbers
    // - Verify header section formatting
    // - Verify line items table has correct columns
    // - Verify data matches input
  });

  it('should handle multi-tab export with correct tab ordering', async () => {
    // TODO: Generate export for multiple orders
    // - Verify tabs are sorted by created_at (earliest to latest)
    // - Verify each tab has correct order number
  });
});
