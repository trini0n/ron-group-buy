/**
 * Unit tests for src/lib/utils.ts
 * Tests all pure utility functions for card pricing, URLs, and formatting
 */

import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  getCardPrice,
  getCardTypeFromSerial,
  getTrackingUrl,
  getScryfallImageUrl,
  isValidRonImageUrl,
  getRonImageUrl,
  getCardImages,
  getCardImageUrl,
  slugify,
  getCardUrl,
  getFinishLabel,
  getFinishBadgeClasses,
  getFrameEffectLabel,
  isDefaultLanguage,
  parseCardSerial,
  compareSerials,
  groupAndSortOrderItems,
  sortOrdersByShippingAndDate,
  cn
} from '../utils'

describe('formatPrice', () => {
  it('formats whole numbers with two decimal places', () => {
    expect(formatPrice(5)).toBe('$5.00')
  })

  it('formats decimal prices correctly', () => {
    expect(formatPrice(1.25)).toBe('$1.25')
    expect(formatPrice(1.5)).toBe('$1.50')
  })

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })
})

describe('getCardPrice', () => {
  it('returns 1.25 for Normal cards', () => {
    expect(getCardPrice('Normal')).toBe(1.25)
  })

  it('returns 1.25 for Holo cards', () => {
    expect(getCardPrice('Holo')).toBe(1.25)
  })

  it('returns 1.50 for Foil cards', () => {
    expect(getCardPrice('Foil')).toBe(1.5)
  })

  it('returns 1.25 for unknown types (default)', () => {
    expect(getCardPrice('Unknown')).toBe(1.25)
  })
})

describe('getCardTypeFromSerial', () => {
  it('detects Holo from H- prefix', () => {
    expect(getCardTypeFromSerial('H-001')).toBe('Holo')
  })

  it('detects Foil from F- prefix', () => {
    expect(getCardTypeFromSerial('F-001')).toBe('Foil')
  })

  it('defaults to Normal for other prefixes', () => {
    expect(getCardTypeFromSerial('N-001')).toBe('Normal')
    expect(getCardTypeFromSerial('X-001')).toBe('Normal')
    expect(getCardTypeFromSerial('001')).toBe('Normal')
  })
})

describe('getTrackingUrl', () => {
  it('generates 17track URL with encoded tracking number', () => {
    expect(getTrackingUrl('ABC123')).toBe('https://www.17track.net/?nums=ABC123')
  })

  it('encodes special characters', () => {
    expect(getTrackingUrl('AB C+123')).toBe('https://www.17track.net/?nums=AB%20C%2B123')
  })
})

describe('getScryfallImageUrl', () => {
  it('generates correct URL structure', () => {
    const id = 'abc12345-6789-0123-4567-890123456789'
    const url = getScryfallImageUrl(id)
    expect(url).toBe(`https://cards.scryfall.io/normal/front/a/b/${id}.jpg`)
  })

  it('respects size parameter', () => {
    const id = 'abc12345-6789-0123-4567-890123456789'
    expect(getScryfallImageUrl(id, 'small')).toContain('/small/')
    expect(getScryfallImageUrl(id, 'large')).toContain('/large/')
    expect(getScryfallImageUrl(id, 'png')).toContain('/png/')
  })
})

describe('isValidRonImageUrl', () => {
  it('returns false for null/undefined', () => {
    expect(isValidRonImageUrl(null)).toBe(false)
  })

  it('returns true for lh3.googleusercontent.com URLs', () => {
    expect(isValidRonImageUrl('https://lh3.googleusercontent.com/abc123')).toBe(true)
  })

  it('returns false for Google Photos share links', () => {
    expect(isValidRonImageUrl('https://photos.google.com/share/xyz')).toBe(false)
    expect(isValidRonImageUrl('https://photos.app.goo.gl/xyz')).toBe(false)
  })

  it('returns true for other direct image URLs', () => {
    expect(isValidRonImageUrl('https://example.com/image.jpg')).toBe(true)
  })
})

describe('getRonImageUrl', () => {
  it('returns null for invalid URLs', () => {
    expect(getRonImageUrl(null)).toBe(null)
    expect(getRonImageUrl('https://photos.google.com/share/xyz')).toBe(null)
  })

  it('normalizes lh3 URLs to w1200 size', () => {
    const input = 'https://lh3.googleusercontent.com/abc=w200'
    expect(getRonImageUrl(input)).toBe('https://lh3.googleusercontent.com/abc=w1200')
  })

  it('strips existing size suffixes before adding w1200', () => {
    const input = 'https://lh3.googleusercontent.com/abc=s200-w100'
    expect(getRonImageUrl(input)).toBe('https://lh3.googleusercontent.com/abc=w1200')
  })

  it('returns non-lh3 URLs unchanged', () => {
    const input = 'https://example.com/image.jpg'
    expect(getRonImageUrl(input)).toBe(input)
  })
})

describe('getCardImages', () => {
  it('returns placeholder when no images available', () => {
    const images = getCardImages(null, null)
    expect(images).toHaveLength(1)
    expect(images[0].label).toBe('Placeholder')
  })

  it('prioritizes Ron image over Scryfall', () => {
    const images = getCardImages(
      'https://lh3.googleusercontent.com/abc',
      'scryfall-id-123'
    )
    expect(images.length).toBeGreaterThanOrEqual(2)
    expect(images[0].label).toBe("Ron's Proxy")
    expect(images[1].label).toBe('Scryfall')
  })

  it('returns only Scryfall when Ron URL is invalid', () => {
    const images = getCardImages(
      'https://photos.google.com/share/xyz',
      'scryfall-id-123'
    )
    expect(images).toHaveLength(1)
    expect(images[0].label).toBe('Scryfall')
  })
})

describe('getCardImageUrl', () => {
  it('prioritizes Ron URL when valid', () => {
    const url = getCardImageUrl(
      'https://lh3.googleusercontent.com/abc',
      'scryfall-id'
    )
    expect(url).toContain('googleusercontent.com')
  })

  it('falls back to Scryfall when Ron URL is invalid', () => {
    const url = getCardImageUrl(
      'https://photos.google.com/share/xyz',
      'scryfall-id-123'
    )
    expect(url).toContain('scryfall.io')
  })

  it('returns placeholder when no images available', () => {
    const url = getCardImageUrl(null, null)
    expect(url).toBe('/images/card-placeholder.png')
  })
})

describe('slugify', () => {
  it('converts text to lowercase URL-safe slug', () => {
    expect(slugify('Wan Shi Tong, Librarian')).toBe('wan-shi-tong-librarian')
  })

  it('removes special characters', () => {
    expect(slugify('Card\'s Name (2024)')).toBe('card-s-name-2024')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('--Test--')).toBe('test')
  })
})

describe('isDefaultLanguage', () => {
  it('returns true for null/undefined', () => {
    expect(isDefaultLanguage(null)).toBe(true)
    expect(isDefaultLanguage(undefined)).toBe(true)
  })

  it('returns true for English', () => {
    expect(isDefaultLanguage('en')).toBe(true)
    expect(isDefaultLanguage('EN')).toBe(true)
  })

  it('returns true for Quenya (fictional language)', () => {
    expect(isDefaultLanguage('qya')).toBe(true)
    expect(isDefaultLanguage('QYA')).toBe(true)
  })

  it('returns true for Phyrexian (fictional language)', () => {
    expect(isDefaultLanguage('ph')).toBe(true)
    expect(isDefaultLanguage('PH')).toBe(true)
  })

  it('returns false for other languages', () => {
    expect(isDefaultLanguage('ja')).toBe(false)
    expect(isDefaultLanguage('de')).toBe(false)
    expect(isDefaultLanguage('fr')).toBe(false)
    expect(isDefaultLanguage('zh')).toBe(false)
  })
})

describe('getCardUrl', () => {
  it('generates correct card URL path for default language', () => {
    const url = getCardUrl({
      set_code: 'MOM',
      collector_number: '123',
      card_name: 'Test Card'
    })
    expect(url).toBe('/card/mom/123/test-card/')
  })

  it('handles null set_code and collector_number', () => {
    const url = getCardUrl({
      set_code: null,
      collector_number: null,
      card_name: 'Test Card'
    })
    expect(url).toBe('/card/unknown/0/test-card/')
  })

  it('includes language segment for non-default languages', () => {
    const url = getCardUrl({
      set_code: 'FIN',
      collector_number: '525',
      card_name: 'Cecil Dark Knight',
      language: 'ja'
    })
    expect(url).toBe('/card/fin/525/ja/cecil-dark-knight/')
  })

  it('omits language segment for English', () => {
    const url = getCardUrl({
      set_code: 'FIN',
      collector_number: '525',
      card_name: 'Cecil Dark Knight',
      language: 'en'
    })
    expect(url).toBe('/card/fin/525/cecil-dark-knight/')
  })

  it('omits language segment for Quenya', () => {
    const url = getCardUrl({
      set_code: 'LTR',
      collector_number: '100',
      card_name: 'Gandalf',
      language: 'qya'
    })
    expect(url).toBe('/card/ltr/100/gandalf/')
  })

  it('omits language segment for Phyrexian', () => {
    const url = getCardUrl({
      set_code: 'INV',
      collector_number: '306',
      card_name: 'Phyrexian Altar',
      language: 'ph'
    })
    expect(url).toBe('/card/inv/306/phyrexian-altar/')
  })
})

describe('getFinishLabel', () => {
  it('returns foil_type when present', () => {
    expect(getFinishLabel({ foil_type: 'Surge Foil', card_type: 'Normal' })).toBe('Surge Foil')
  })

  it('falls back to card_type', () => {
    expect(getFinishLabel({ foil_type: null, card_type: 'Holo' })).toBe('Holo')
  })
})

describe('getFinishBadgeClasses', () => {
  it('returns zinc classes for Normal', () => {
    expect(getFinishBadgeClasses('Normal')).toContain('zinc')
  })

  it('returns violet classes for Holo', () => {
    expect(getFinishBadgeClasses('Holo')).toContain('violet')
  })

  it('returns amber classes for Foil', () => {
    expect(getFinishBadgeClasses('Foil')).toContain('amber')
  })

  it('returns cyan classes for Surge Foil', () => {
    expect(getFinishBadgeClasses('Surge Foil')).toContain('cyan')
  })

  it('returns secondary fallback for unknown', () => {
    expect(getFinishBadgeClasses('Unknown')).toContain('secondary')
  })
})

describe('getFrameEffectLabel', () => {
  it('returns null for no effects', () => {
    expect(getFrameEffectLabel({ is_retro: false })).toBe(null)
  })

  it('returns single effect', () => {
    expect(getFrameEffectLabel({ is_retro: true })).toBe('Retro')
    expect(getFrameEffectLabel({ is_extended: true })).toBe('Extended Art')
    expect(getFrameEffectLabel({ is_etched: true })).toBe('Etched')
  })

  it('combines multiple effects', () => {
    const result = getFrameEffectLabel({ is_retro: true, is_etched: true })
    expect(result).toBe('Retro, Etched')
  })

  it('showcase supersedes borderless', () => {
    const result = getFrameEffectLabel({ is_showcase: true, is_borderless: true })
    expect(result).toBe('Showcase')
    expect(result).not.toContain('Borderless')
  })

  it('returns borderless when showcase is false', () => {
    const result = getFrameEffectLabel({ is_borderless: true, is_showcase: false })
    expect(result).toBe('Borderless')
  })

  it('returns null for null card', () => {
    expect(getFrameEffectLabel(null)).toBe(null)
  })
})

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('class1', 'class2')
    expect(result).toContain('class1')
    expect(result).toContain('class2')
  })

  it('handles conditional classes', () => {
    const result = cn('base', false && 'conditional', 'other')
    expect(result).toContain('base')
    expect(result).toContain('other')
    expect(result).not.toContain('conditional')
  })
})

describe('parseCardSerial', () => {
  it('parses standard serial format', () => {
    expect(parseCardSerial('N-47')).toEqual({ prefix: 'N', number: 47, suffix: '' })
    expect(parseCardSerial('H-100')).toEqual({ prefix: 'H', number: 100, suffix: '' })
    expect(parseCardSerial('F-5')).toEqual({ prefix: 'F', number: 5, suffix: '' })
  })

  it('parses serials with letter suffixes', () => {
    expect(parseCardSerial('N-47a')).toEqual({ prefix: 'N', number: 47, suffix: 'a' })
    expect(parseCardSerial('N-47b')).toEqual({ prefix: 'N', number: 47, suffix: 'b' })
    expect(parseCardSerial('H-100abc')).toEqual({ prefix: 'H', number: 100, suffix: 'abc' })
  })

  it('handles non-standard format with fallback', () => {
    const result = parseCardSerial('INVALID')
    expect(result.prefix).toBe('')
    expect(result.number).toBe(0)
    expect(result.suffix).toBe('INVALID')
  })
})

describe('compareSerials', () => {
  it('sorts by prefix order: Normal < Holo < Foil', () => {
    expect(compareSerials('N-50', 'H-10')).toBeLessThan(0)
    expect(compareSerials('H-50', 'F-10')).toBeLessThan(0)
    expect(compareSerials('F-50', 'N-100')).toBeGreaterThan(0)
  })

  it('sorts by number within same prefix (natural sort)', () => {
    expect(compareSerials('H-5', 'H-50')).toBeLessThan(0)
    expect(compareSerials('H-50', 'H-100')).toBeLessThan(0)
    expect(compareSerials('N-9', 'N-100')).toBeLessThan(0)
  })

  it('sorts by suffix when prefix and number are same', () => {
    expect(compareSerials('N-47a', 'N-47b')).toBeLessThan(0)
    expect(compareSerials('N-47b', 'N-47a')).toBeGreaterThan(0)
    expect(compareSerials('N-47a', 'N-47a')).toBe(0)
  })

  it('sorts complete example correctly', () => {
    const serials = ['H-100', 'N-50', 'F-25', 'H-5', 'N-5', 'N-47a', 'N-47b', 'N-47']
    const sorted = [...serials].sort(compareSerials)
    expect(sorted).toEqual(['N-5', 'N-47', 'N-47a', 'N-47b', 'N-50', 'H-5', 'H-100', 'F-25'])
  })
})

describe('groupAndSortOrderItems', () => {
  it('groups and sorts items by prefix then number', () => {
    const items = [
      { card_serial: 'H-100', card_name: 'Card 1' },
      { card_serial: 'N-50', card_name: 'Card 2' },
      { card_serial: 'F-25', card_name: 'Card 3' },
      { card_serial: 'N-5', card_name: 'Card 4' },
      { card_serial: 'H-5', card_name: 'Card 5' }
    ]
    
    const sorted = groupAndSortOrderItems(items)
    
    expect(sorted.map(item => item.card_serial)).toEqual([
      'N-5',
      'N-50',
      'H-5',
      'H-100',
      'F-25'
    ])
  })

  it('handles items with suffixes', () => {
    const items = [
      { card_serial: 'N-47b', card_name: 'Card 1' },
      { card_serial: 'N-47', card_name: 'Card 2' },
      { card_serial: 'N-47a', card_name: 'Card 3' }
    ]
    
    const sorted = groupAndSortOrderItems(items)
    
    expect(sorted.map(item => item.card_serial)).toEqual([
      'N-47',
      'N-47a',
      'N-47b'
    ])
  })

  it('does not mutate original array', () => {
    const items = [
      { card_serial: 'H-100', card_name: 'Card 1' },
      { card_serial: 'N-50', card_name: 'Card 2' }
    ]
    
    const original = [...items]
    groupAndSortOrderItems(items)
    
    expect(items).toEqual(original)
  })
})

describe('sortOrdersByShippingAndDate', () => {
  it('sorts express shipping before regular', () => {
    const orders = [
      { shipping_type: 'regular', created_at: '2024-01-01T00:00:00Z', id: '1' },
      { shipping_type: 'express', created_at: '2024-01-02T00:00:00Z', id: '2' }
    ]
    
    const sorted = sortOrdersByShippingAndDate(orders)
    
    expect(sorted[0].shipping_type).toBe('express')
    expect(sorted[1].shipping_type).toBe('regular')
  })

  it('sorts by created_at within same shipping type', () => {
    const orders = [
      { shipping_type: 'regular', created_at: '2024-01-03T00:00:00Z', id: '3' },
      { shipping_type: 'regular', created_at: '2024-01-01T00:00:00Z', id: '1' },
      { shipping_type: 'regular', created_at: '2024-01-02T00:00:00Z', id: '2' }
    ]
    
    const sorted = sortOrdersByShippingAndDate(orders)
    
    expect(sorted[0].id).toBe('1')
    expect(sorted[1].id).toBe('2')
    expect(sorted[2].id).toBe('3')
  })

  it('handles mixed shipping types with dates', () => {
    const orders = [
      { shipping_type: 'regular', created_at: '2024-01-02T00:00:00Z', id: 'R2' },
      { shipping_type: 'express', created_at: '2024-01-04T00:00:00Z', id: 'E2' },
      { shipping_type: 'regular', created_at: '2024-01-01T00:00:00Z', id: 'R1' },
      { shipping_type: 'express', created_at: '2024-01-03T00:00:00Z', id: 'E1' }
    ]
    
    const sorted = sortOrdersByShippingAndDate(orders)
    
    expect(sorted.map(o => o.id)).toEqual(['E1', 'E2', 'R1', 'R2'])
  })

  it('handles null values gracefully', () => {
    const orders = [
      { shipping_type: null, created_at: '2024-01-02T00:00:00Z', id: '1' },
      { shipping_type: 'express', created_at: null, id: '2' },
      { shipping_type: 'regular', created_at: '2024-01-01T00:00:00Z', id: '3' }
    ]
    
    // Should not throw
    const sorted = sortOrdersByShippingAndDate(orders)
    
    expect(sorted.length).toBe(3)
    // Express should be first (even with null date)
    expect(sorted[0].shipping_type).toBe('express')
  })

  it('does not mutate original array', () => {
    const orders = [
      { shipping_type: 'regular', created_at: '2024-01-01T00:00:00Z', id: '1' },
      { shipping_type: 'express', created_at: '2024-01-02T00:00:00Z', id: '2' }
    ]
    
    const original = [...orders]
    sortOrdersByShippingAndDate(orders)
    
    expect(orders).toEqual(original)
  })
})
