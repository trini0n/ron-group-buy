import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../+server';

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  json: vi.fn((data) => data),
  error: vi.fn((status, message) => {
    const err = new Error(message);
    (err as any).status = status;
    throw err; // throw instead of return so rejects works natively
  })
}));

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validItems = [
    { cardId: 'card-1', serial: '001', name: 'Test Card', cardType: 'Normal', quantity: 1, unitPrice: 1.0 }
  ];

  it('throws 400 if phoneNumber is missing', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        items: validItems
        // phoneNumber missing
      })
    };

    const mockLocals = {
      user: { id: '123' }
    };

    await expect(
      POST({ request: mockRequest, locals: mockLocals } as any)
    ).rejects.toThrow('Phone number is required');
  });

  it('throws 400 if phoneNumber is empty whitespace', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        items: validItems,
        phoneNumber: '   '
      })
    };

    const mockLocals = {
      user: { id: '123' }
    };

    await expect(
      POST({ request: mockRequest, locals: mockLocals } as any)
    ).rejects.toThrow('Phone number is required');
  });

  it('does not throw phone error if valid phone number is provided', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        items: validItems,
        phoneNumber: '555-0199'
      })
    };

    // Very basic mock of supabase to avoid throwing too early
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      })
    };

    const mockLocals = {
      user: { id: '123' },
      supabase: mockSupabase
    };

    try {
      await POST({ request: mockRequest, locals: mockLocals } as any);
      // It might pass entirely if we don't mock the rest, or fail on something else
    } catch (e: any) {
      expect(e.message).not.toContain('Phone number is required');
    }
  });

});
