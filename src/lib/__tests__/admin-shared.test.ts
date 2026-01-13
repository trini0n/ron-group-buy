/**
 * Unit tests for src/lib/admin-shared.ts
 * Tests admin access control and order status logic
 */

import { describe, it, expect } from 'vitest'
import {
  ADMIN_DISCORD_IDS,
  isAdminDiscordId,
  getNextStatuses,
  ORDER_STATUS_CONFIG
} from '../admin-shared'

describe('ADMIN_DISCORD_IDS', () => {
  it('contains expected admin IDs', () => {
    expect(ADMIN_DISCORD_IDS).toContain('83470831350448128')
    expect(ADMIN_DISCORD_IDS).toContain('431606995100106762')
  })
})

describe('isAdminDiscordId', () => {
  it('returns true for valid admin IDs', () => {
    expect(isAdminDiscordId('83470831350448128')).toBe(true)
    expect(isAdminDiscordId('431606995100106762')).toBe(true)
  })

  it('returns false for non-admin IDs', () => {
    expect(isAdminDiscordId('12345678901234567')).toBe(false)
    expect(isAdminDiscordId('random-id')).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isAdminDiscordId(null)).toBe(false)
    expect(isAdminDiscordId(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isAdminDiscordId('')).toBe(false)
  })
})

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
