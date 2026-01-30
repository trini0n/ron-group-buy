// Tests for Card Identity Service

import { describe, it, expect } from 'vitest'
import {
  generateCardIdentityKey,
  extractCardIdentity,
  isSameIdentity,
  detectDuplicatesInBatch,
  type CardIdentity,
  type CardWithIdentity
} from '../card-identity'

describe('Card Identity Service', () => {
  describe('generateCardIdentityKey', () => {
    it('should generate key with all fields', () => {
      const identity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        is_foil: true,
        is_etched: false,
        language: 'en'
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('fdn|123|lightning bolt|true|false|en')
    })

    it('should generate key with missing collector_number', () => {
      const identity: CardIdentity = {
        set_code: 'ECL',
        collector_number: null,
        card_name: 'Wistfulness',
        is_foil: false,
        is_etched: false,
        language: 'en'
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('ecl||wistfulness|false|false|en')
    })

    it('should normalize text fields (trim and lowercase)', () => {
      const identity: CardIdentity = {
        set_code: '  FDN  ',
        collector_number: ' 123 ',
        card_name: '  Lightning BOLT  ',
        is_foil: false,
        is_etched: false,
        language: 'EN'
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('fdn|123|lightning bolt|false|false|en')
    })

    it('should handle etched foil cards', () => {
      const identity: CardIdentity = {
        set_code: 'CMM',
        collector_number: '456',
        card_name: 'Sol Ring',
        is_foil: false,
        is_etched: true,
        language: 'en'
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('cmm|456|sol ring|false|true|en')
    })

    it('should handle non-English languages', () => {
      const identity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '100',
        card_name: 'Rayo',
        is_foil: false,
        is_etched: false,
        language: 'es'
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('fdn|100|rayo|false|false|es')
    })

    it('should default language to en when missing', () => {
      const identity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '100',
        card_name: 'Test Card',
        is_foil: false,
        is_etched: false,
        language: ''
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('fdn|100|test card|false|false|en')
    })

    it('should handle null set_code', () => {
      const identity: CardIdentity = {
        set_code: null,
        collector_number: '100',
        card_name: 'Test Card',
        is_foil: false,
        is_etched: false,
        language: 'en'
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('|100|test card|false|false|en')
    })
  })

  describe('extractCardIdentity', () => {
    it('should extract identity from card object', () => {
      const card: CardWithIdentity = {
        id: 'uuid-1',
        serial: 'H-2557',
        card_name: 'Wistfulness',
        set_code: 'ECL',
        collector_number: '123',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_in_stock: true
      }

      const identity = extractCardIdentity(card)
      expect(identity).toEqual({
        set_code: 'ECL',
        collector_number: '123',
        card_name: 'Wistfulness',
        is_foil: true,
        is_etched: false,
        language: 'en'
      })
    })

    it('should handle partial card objects', () => {
      const partial = {
        card_name: 'Test',
        set_code: 'TST'
      }

      const identity = extractCardIdentity(partial)
      expect(identity).toEqual({
        set_code: 'TST',
        collector_number: null,
        card_name: 'Test',
        is_foil: false,
        is_etched: false,
        language: 'en'
      })
    })
  })

  describe('isSameIdentity', () => {
    it('should return true for identical cards', () => {
      const card1: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        is_foil: true,
        is_etched: false,
        language: 'en'
      }

      const card2: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        is_foil: true,
        is_etched: false,
        language: 'en'
      }

      expect(isSameIdentity(card1, card2)).toBe(true)
    })

    it('should return false for different foil status', () => {
      const card1: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        is_foil: true,
        is_etched: false,
        language: 'en'
      }

      const card2: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        is_foil: false,
        is_etched: false,
        language: 'en'
      }

      expect(isSameIdentity(card1, card2)).toBe(false)
    })

    it('should return false for different collector numbers', () => {
      const card1: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        is_foil: false,
        is_etched: false,
        language: 'en'
      }

      const card2: CardIdentity = {
        set_code: 'FDN',
        collector_number: '456',
        card_name: 'Lightning Bolt',
        is_foil: false,
        is_etched: false,
        language: 'en'
      }

      expect(isSameIdentity(card1, card2)).toBe(false)
    })

    it('should handle case-insensitive name matching', () => {
      const card1: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        is_foil: false,
        is_etched: false,
        language: 'en'
      }

      const card2: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'LIGHTNING BOLT',
        is_foil: false,
        is_etched: false,
        language: 'en'
      }

      expect(isSameIdentity(card1, card2)).toBe(true)
    })
  })

  describe('detectDuplicatesInBatch', () => {
    it('should return empty array when no duplicates', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-100',
          card_name: 'Card A',
          set_code: 'SET1',
          collector_number: '1',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Card B',
          set_code: 'SET1',
          collector_number: '2',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toEqual([])
    })

    it('should detect exact duplicates and keep highest serial', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-100',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].keptSerial).toBe('H-200')
      expect(duplicates[0].markedOosSerials).toEqual(['H-100'])
    })

    it('should keep highest serial among multiple duplicates', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-50',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-2',
          serial: 'H-300',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-3',
          serial: 'H-150',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].keptSerial).toBe('H-300')
      expect(duplicates[0].markedOosSerials).toEqual(['H-150', 'H-50'])
    })

    it('should treat foil and non-foil as different cards', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-100',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          is_foil: true,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toEqual([])
    })

    it('should handle multiple duplicate groups', () => {
      const cards: CardWithIdentity[] = [
        // Group 1: Lightning Bolt
        {
          id: 'uuid-1',
          serial: 'H-100',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        // Group 2: Sol Ring
        {
          id: 'uuid-3',
          serial: 'H-50',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-4',
          serial: 'H-150',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toHaveLength(2)
    })

    it('should handle cards with null collector_number', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-100',
          card_name: 'Promo Card',
          set_code: 'PROMO',
          collector_number: null,
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Promo Card',
          set_code: 'PROMO',
          collector_number: null,
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].keptSerial).toBe('H-200')
    })

    it('should sort serials numerically, not alphabetically', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'N-9',
          card_name: 'Test Card',
          set_code: 'TST',
          collector_number: '100',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-2',
          serial: 'N-108',
          card_name: 'Test Card',
          set_code: 'TST',
          collector_number: '100',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-3',
          serial: 'H-83',
          card_name: 'Another Card',
          set_code: 'TST',
          collector_number: '200',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        },
        {
          id: 'uuid-4',
          serial: 'H-100',
          card_name: 'Another Card',
          set_code: 'TST',
          collector_number: '200',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toHaveLength(2)

      // N-108 should be kept over N-9 (108 > 9 numerically)
      const nGroup = duplicates.find(d => d.keptSerial.startsWith('N-'))
      expect(nGroup?.keptSerial).toBe('N-108')
      expect(nGroup?.markedOosSerials).toEqual(['N-9'])

      // H-100 should be kept over H-83 (100 > 83)
      const hGroup = duplicates.find(d => d.keptSerial.startsWith('H-'))
      expect(hGroup?.keptSerial).toBe('H-100')
      expect(hGroup?.markedOosSerials).toEqual(['H-83'])
    })
  })
})
