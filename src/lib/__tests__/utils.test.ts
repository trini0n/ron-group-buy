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

describe('getCardUrl', () => {
  it('generates correct card URL path', () => {
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
