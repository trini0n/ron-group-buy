/**
 * Unit tests for src/lib/deck-utils.ts
 * Tests deck parsing and card type extraction
 */

import { describe, it, expect } from 'vitest'
import { extractPrimaryType, parseDeckList, TYPE_ORDER } from '$lib/deck-utils'

describe('extractPrimaryType', () => {
  it('returns "Other" for empty string', () => {
    expect(extractPrimaryType('')).toBe('Other')
  })

  it('extracts Creature type', () => {
    expect(extractPrimaryType('Creature — Human Wizard')).toBe('Creature')
    expect(extractPrimaryType('Legendary Creature — Dragon')).toBe('Creature')
  })

  it('extracts Planeswalker type', () => {
    expect(extractPrimaryType('Legendary Planeswalker — Jace')).toBe('Planeswalker')
  })

  it('extracts Artifact type', () => {
    expect(extractPrimaryType('Artifact — Equipment')).toBe('Artifact')
    expect(extractPrimaryType('Legendary Artifact')).toBe('Artifact')
  })

  it('extracts Enchantment type', () => {
    expect(extractPrimaryType('Enchantment — Aura')).toBe('Enchantment')
  })

  it('extracts Instant type', () => {
    expect(extractPrimaryType('Instant')).toBe('Instant')
  })

  it('extracts Sorcery type', () => {
    expect(extractPrimaryType('Sorcery')).toBe('Sorcery')
  })

  it('extracts Land type', () => {
    expect(extractPrimaryType('Land')).toBe('Land')
    expect(extractPrimaryType('Basic Land — Forest')).toBe('Land')
    expect(extractPrimaryType('Snow Land')).toBe('Land')
  })

  it('handles Artifact Creature (Creature takes priority)', () => {
    expect(extractPrimaryType('Artifact Creature — Golem')).toBe('Creature')
  })

  it('handles Enchantment Creature (Creature takes priority)', () => {
    expect(extractPrimaryType('Enchantment Creature — Nymph')).toBe('Creature')
  })

  it('strips supertypes correctly', () => {
    expect(extractPrimaryType('Legendary Snow Enchantment')).toBe('Enchantment')
    expect(extractPrimaryType('World Enchantment')).toBe('Enchantment')
  })
})

describe('TYPE_ORDER', () => {
  it('orders Creature before Land', () => {
    expect(TYPE_ORDER.Creature!).toBeLessThan(TYPE_ORDER.Land!)
  })

  it('orders Land last (before Other)', () => {
    expect(TYPE_ORDER.Land).toBe(6)
    expect(TYPE_ORDER.Other!).toBe(7)
  })
})

describe('parseDeckList', () => {
  it('parses simple format "1 Card Name"', () => {
    const result = parseDeckList('1 Lightning Bolt')
    expect(result).toHaveLength(1)
    expect(result[0]!).toMatchObject({
      quantity: 1,
      name: 'Lightning Bolt',
      boardType: 'mainboard'
    })
  })

  it('parses multiple cards', () => {
    const result = parseDeckList('4 Lightning Bolt\n4 Counterspell\n2 Island')
    expect(result).toHaveLength(3)
    expect(result[0]!.quantity).toBe(4)
    expect(result[1]!.name).toBe('Counterspell')
    expect(result[2]!.quantity).toBe(2)
  })

  it('parses format with set code "1 Card Name (SET)"', () => {
    const result = parseDeckList('1 Lightning Bolt (MH2)')
    expect(result).toHaveLength(1)
    expect(result[0]!.set).toBe('MH2')
  })

  it('parses format with set and collector number', () => {
    const result = parseDeckList('1 Lightning Bolt (MH2) 123')
    expect(result).toHaveLength(1)
    expect(result[0]!.set).toBe('MH2')
    expect(result[0]!.collectorNumber).toBe('123')
  })

  it('parses format with foil marker', () => {
    const result = parseDeckList('1 Lightning Bolt (MH2) 123 *F*')
    expect(result).toHaveLength(1)
    expect(result[0]!.foil).toBe(true)
  })

  it('ignores empty lines', () => {
    const result = parseDeckList('1 Card A\n\n\n1 Card B')
    expect(result).toHaveLength(2)
  })

  it('handles cards with special characters in name', () => {
    const result = parseDeckList("1 Jace, the Mind Sculptor")
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('Jace, the Mind Sculptor')
  })

  it('handles cards with apostrophes', () => {
    const result = parseDeckList("1 Nature's Claim")
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe("Nature's Claim")
  })

  it('returns empty array for empty input', () => {
    const result = parseDeckList('')
    expect(result).toHaveLength(0)
  })

  it('uppercases set codes', () => {
    const result = parseDeckList('1 Card (mh2)')
    expect(result[0]!.set).toBe('MH2')
  })
})
