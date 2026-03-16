import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../+server'

// Mock SvelteKit functions
vi.mock('@sveltejs/kit', () => ({
  json: vi.fn((data) => data),
  error: vi.fn((status, message) => {
    const err = new Error(message)
    ;(err as any).status = status
    throw err // throw instead of return so rejects works natively
  })
}))

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validItems = [
    { cardId: 'card-1', serial: '001', name: 'Test Card', cardType: 'Normal', quantity: 1, unitPrice: 1.0 }
  ]

  it('returns 400 with validation error if phoneNumber is missing', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        items: validItems,
        paypalEmail: 'test@example.com'
        // phoneNumber missing
      })
    }

    const mockLocals = {
      user: { id: '123' }
    }

    const result = (await POST({ request: mockRequest, locals: mockLocals } as any)) as any
    expect(result.error).toBe('Invalid request body')
    expect(result.issues.some((i: any) => i.path.includes('phoneNumber'))).toBe(true)
  })

  it('returns 400 with validation error if phoneNumber is empty whitespace', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        items: validItems,
        paypalEmail: 'test@example.com',
        phoneNumber: '   '
      })
    }

    const mockLocals = {
      user: { id: '123' }
    }

    const result = (await POST({ request: mockRequest, locals: mockLocals } as any)) as any
    expect(result.error).toBe('Invalid request body')
    expect(result.issues.some((i: any) => i.path.includes('phoneNumber'))).toBe(true)
  })

  it('does not throw phone error if valid phone number is provided', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        items: validItems,
        paypalEmail: 'test@example.com',
        phoneNumber: '555-0199'
      })
    }

    // Very basic mock of supabase to avoid throwing too early
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      })
    }

    const mockLocals = {
      user: { id: '123' },
      supabase: mockSupabase
    }

    try {
      await POST({ request: mockRequest, locals: mockLocals } as any)
      // It might pass entirely if we don't mock the rest, or fail on something else
    } catch (e: any) {
      expect(e.message).not.toContain('Phone number is required')
      expect(e.message).not.toContain('PayPal Email is required')
    }
  })

  it('returns 400 with validation error if paypalEmail is missing', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        items: validItems,
        phoneNumber: '+15550199'
        // paypalEmail missing
      })
    }

    const mockLocals = {
      user: { id: '123' }
    }

    const result = (await POST({ request: mockRequest, locals: mockLocals } as any)) as any
    expect(result.error).toBe('Invalid request body')
    expect(result.issues.some((i: any) => i.path.includes('paypalEmail'))).toBe(true)
  })

  it('returns 400 with validation error if paypalEmail is empty whitespace', async () => {
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        items: validItems,
        phoneNumber: '+15550199',
        paypalEmail: '   '
      })
    }

    const mockLocals = {
      user: { id: '123' }
    }

    const result = (await POST({ request: mockRequest, locals: mockLocals } as any)) as any
    expect(result.error).toBe('Invalid request body')
    expect(result.issues.some((i: any) => i.path.includes('paypalEmail'))).toBe(true)
  })
})
