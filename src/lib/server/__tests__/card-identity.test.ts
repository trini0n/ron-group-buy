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
        card_type: 'Foil',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('fdn|123|lightning bolt|foil|true|false|en|false')
    })

    it('should generate key with missing collector_number', () => {
      const identity: CardIdentity = {
        set_code: 'ECL',
        collector_number: null,
        card_name: 'Wistfulness',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('ecl||wistfulness|normal|false|false|en|false')
    })

    it('should normalize text fields (trim and lowercase)', () => {
      const identity: CardIdentity = {
        set_code: '  FDN  ',
        collector_number: ' 123 ',
        card_name: '  Lightning BOLT  ',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'EN',
        is_misprint: false
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('fdn|123|lightning bolt|normal|false|false|en|false')
    })

    it('should handle etched foil cards', () => {
      const identity: CardIdentity = {
        set_code: 'CMM',
        collector_number: '456',
        card_name: 'Sol Ring',
        card_type: 'Foil',
        is_foil: false,
        is_etched: true,
        language: 'en',
        is_misprint: false
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('cmm|456|sol ring|foil|false|true|en|false')
    })

    it('should handle non-English languages', () => {
      const identity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '100',
        card_name: 'Rayo',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'es',
        is_misprint: false
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('fdn|100|rayo|normal|false|false|es|false')
    })

    it('should default language to en when missing', () => {
      const identity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '100',
        card_name: 'Test Card',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: '',
        is_misprint: false
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('fdn|100|test card|normal|false|false|en|false')
    })

    it('should handle null set_code', () => {
      const identity: CardIdentity = {
        set_code: null,
        collector_number: '100',
        card_name: 'Test Card',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const key = generateCardIdentityKey(identity)
      expect(key).toBe('|100|test card|normal|false|false|en|false')
    })

    it('should generate different keys for Holo vs Foil variants', () => {
      const holoIdentity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Holo',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const foilIdentity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Foil',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const holoKey = generateCardIdentityKey(holoIdentity)
      const foilKey = generateCardIdentityKey(foilIdentity)
      expect(holoKey).not.toBe(foilKey)
      expect(holoKey).toBe('fdn|123|lightning bolt|holo|true|false|en|false')
      expect(foilKey).toBe('fdn|123|lightning bolt|foil|true|false|en|false')
    })

    it('should generate different keys for misprint vs non-misprint cards', () => {
      const normalIdentity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Holo',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const misprintIdentity: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Holo',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: true
      }

      const normalKey = generateCardIdentityKey(normalIdentity)
      const misprintKey = generateCardIdentityKey(misprintIdentity)
      expect(normalKey).not.toBe(misprintKey)
      expect(normalKey).toBe('fdn|123|lightning bolt|holo|false|false|en|false')
      expect(misprintKey).toBe('fdn|123|lightning bolt|holo|false|false|en|true')
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
        card_type: 'Holo',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_in_stock: true,
        is_misprint: false
      }

      const identity = extractCardIdentity(card)
      expect(identity).toEqual({
        set_code: 'ECL',
        collector_number: '123',
        card_name: 'Wistfulness',
        card_type: 'Holo',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
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
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      })
    })
  })

  describe('isSameIdentity', () => {
    it('should return true for identical cards', () => {
      const card1: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Foil',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const card2: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Foil',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      expect(isSameIdentity(card1, card2)).toBe(true)
    })

    it('should return false for different foil status', () => {
      const card1: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Foil',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const card2: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      expect(isSameIdentity(card1, card2)).toBe(false)
    })

    it('should return false for different collector numbers', () => {
      const card1: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const card2: CardIdentity = {
        set_code: 'FDN',
        collector_number: '456',
        card_name: 'Lightning Bolt',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      expect(isSameIdentity(card1, card2)).toBe(false)
    })

    it('should handle case-insensitive name matching', () => {
      const card1: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const card2: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'LIGHTNING BOLT',
        card_type: 'Normal',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      expect(isSameIdentity(card1, card2)).toBe(true)
    })

    it('should return false for Holo vs Foil (same name/set/collector, both is_foil=true)', () => {
      // Regression test: this was the original bug — Holo + Foil of same card
      // shared is_foil=true and collapsed into the same key, marking one as OOS.
      const holo: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Holo',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const foil: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Foil',
        is_foil: true,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      expect(isSameIdentity(holo, foil)).toBe(false)
    })

    it('should return false for misprint vs non-misprint (same name/set/collector/type)', () => {
      // Regression test: misprint and non-misprint of the same card must have
      // distinct identity keys so neither is incorrectly marked OOS as a duplicate.
      const normal: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Holo',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: false
      }

      const misprint: CardIdentity = {
        set_code: 'FDN',
        collector_number: '123',
        card_name: 'Lightning Bolt',
        card_type: 'Holo',
        is_foil: false,
        is_etched: false,
        language: 'en',
        is_misprint: true
      }

      expect(isSameIdentity(normal, misprint)).toBe(false)
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
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Card B',
          set_code: 'SET1',
          collector_number: '2',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
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
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0]!.keptSerial).toBe('H-200')
      expect(duplicates[0]!.markedOosSerials).toEqual(['H-100'])
    })

    it('should keep highest serial among multiple duplicates', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-50',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'H-300',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-3',
          serial: 'H-150',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0]!.keptSerial).toBe('H-300')
      expect(duplicates[0]!.markedOosSerials).toEqual(['H-150', 'H-50'])
    })

    it('should treat foil and non-foil as different cards', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-100',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          card_type: 'Foil',
          is_foil: true,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toEqual([])
    })

    it('should NOT treat Holo and Foil variants as duplicates (regression: foil-holo-oos-on-import)', () => {
      // Before the fix: both H-1000 (Holo) and F-500 (Foil) had is_foil=true
      // → same identity key → F-500 marked OOS by duplicate detection.
      // After the fix: card_type is part of the key so Holo ≠ Foil.
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-1000',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          card_type: 'Holo',
          is_foil: true,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'F-500',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          card_type: 'Foil',
          is_foil: true,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      // Should be zero — Holo and Foil are distinct cards, NOT duplicates.
      expect(duplicates).toEqual([])
    })

    it('should NOT treat misprint and non-misprint as duplicates (regression: misprint-oos-on-import)', () => {
      // Without is_misprint in the identity key, a misprint and non-misprint of
      // the same card would collapse into one key, marking the lower serial OOS.
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'H-100',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: true
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      // Should be zero — misprint and non-misprint are distinct cards, NOT duplicates.
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
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Lightning Bolt',
          set_code: 'FDN',
          collector_number: '123',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        // Group 2: Sol Ring
        {
          id: 'uuid-3',
          serial: 'H-50',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-4',
          serial: 'H-150',
          card_name: 'Sol Ring',
          set_code: 'CMM',
          collector_number: '456',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
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
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'H-200',
          card_name: 'Promo Card',
          set_code: 'PROMO',
          collector_number: null,
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        }
      ]

      const duplicates = detectDuplicatesInBatch(cards)
      expect(duplicates).toHaveLength(1)
      expect(duplicates[0]!.keptSerial).toBe('H-200')
    })

    it('should sort serials numerically, not alphabetically', () => {
      const cards: CardWithIdentity[] = [
        {
          id: 'uuid-1',
          serial: 'N-9',
          card_name: 'Test Card',
          set_code: 'TST',
          collector_number: '100',
          card_type: 'Normal',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-2',
          serial: 'N-108',
          card_name: 'Test Card',
          set_code: 'TST',
          collector_number: '100',
          card_type: 'Normal',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-3',
          serial: 'H-83',
          card_name: 'Another Card',
          set_code: 'TST',
          collector_number: '200',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
        },
        {
          id: 'uuid-4',
          serial: 'H-100',
          card_name: 'Another Card',
          set_code: 'TST',
          collector_number: '200',
          card_type: 'Holo',
          is_foil: false,
          is_etched: false,
          language: 'en',
          is_in_stock: true,
          is_misprint: false
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
