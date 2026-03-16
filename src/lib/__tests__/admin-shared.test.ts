/**
 * Unit tests for src/lib/admin-shared.ts
 * Tests admin access control and order status logic
 */

import { describe, it, expect } from 'vitest'
import { getNextStatuses, ORDER_STATUS_CONFIG } from '../admin-shared'

describe('ORDER_STATUS_CONFIG', () => {
  it('has all expected statuses', () => {
    // Note: 'processing' was combined with 'paid' as "Paid & Processing"
    const statuses = ['pending', 'invoiced', 'paid', 'shipped', 'delivered', 'cancelled']
    for (const status of statuses) {
      expect(ORDER_STATUS_CONFIG).toHaveProperty(status)
      expect(ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]).toHaveProperty('label')
      expect(ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]).toHaveProperty('color')
      expect(ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]).toHaveProperty('description')
    }
  })
})

describe('getNextStatuses', () => {
  it('pending can go to invoiced or cancelled', () => {
    const next = getNextStatuses('pending')
    expect(next).toContain('invoiced')
    expect(next).toContain('cancelled')
    expect(next).not.toContain('paid')
  })

  it('invoiced can go to paid or cancelled', () => {
    const next = getNextStatuses('invoiced')
    expect(next).toContain('paid')
    expect(next).toContain('cancelled')
  })

  it('paid can go to shipped or cancelled', () => {
    // Paid now includes processing, so next step is shipped
    const next = getNextStatuses('paid')
    expect(next).toContain('shipped')
    expect(next).toContain('cancelled')
  })

  it('shipped can only go to delivered', () => {
    const next = getNextStatuses('shipped')
    expect(next).toEqual(['delivered'])
  })

  it('delivered has no next statuses', () => {
    const next = getNextStatuses('delivered')
    expect(next).toEqual([])
  })

  it('cancelled can be reactivated to pending', () => {
    const next = getNextStatuses('cancelled')
    expect(next).toContain('pending')
  })
})
