/**
 * Unit tests for src/lib/search-normalize.ts
 * Tests diacritics stripping and punctuation normalization
 */

import { describe, it, expect } from 'vitest'
import { normalizeForSearch } from '../search-normalize'

describe('normalizeForSearch', () => {
  it('lowercases input', () => {
    expect(normalizeForSearch('Lightning Bolt')).toBe('lightning bolt')
  })

  it('trims whitespace', () => {
    expect(normalizeForSearch('  Card Name  ')).toBe('card name')
  })

  it('strips diacritics (acute, circumflex, grave, etc.)', () => {
    expect(normalizeForSearch('Andúril')).toBe('anduril')
    expect(normalizeForSearch('Nazgûl')).toBe('nazgul')
    expect(normalizeForSearch('Séance')).toBe('seance')
    expect(normalizeForSearch('Ölvir')).toBe('olvir')
    expect(normalizeForSearch('Dùnedain')).toBe('dunedain')
  })

  it('replaces hyphens with spaces', () => {
    expect(normalizeForSearch('Fire-Lit Thicket')).toBe('fire lit thicket')
    expect(normalizeForSearch('Sword of Body-and-Mind')).toBe('sword of body and mind')
  })

  it('strips punctuation and replaces with spaces', () => {
    expect(normalizeForSearch('Ach! Hans, Run!')).toBe('ach hans run')
    expect(normalizeForSearch("Who // What // When // Where // Why")).toBe('who what when where why')
  })

  it('collapses multiple spaces into one', () => {
    expect(normalizeForSearch('Some   Card   Name')).toBe('some card name')
    expect(normalizeForSearch('A--B')).toBe('a b')
  })

  it('ensures normalized query matches normalized card name', () => {
    // User types "anduril", card is stored as "Andúril"
    expect(normalizeForSearch('Andúril').includes(normalizeForSearch('anduril'))).toBe(true)
    // User types "nazgul", card is stored as "Nazgûl"
    expect(normalizeForSearch('Nazgûl').includes(normalizeForSearch('nazgul'))).toBe(true)
    // User types "seance", card is stored as "Séance"
    expect(normalizeForSearch('Séance').includes(normalizeForSearch('seance'))).toBe(true)
  })

  it('handles plain ASCII input unchanged (except lowercase)', () => {
    expect(normalizeForSearch('Mountain')).toBe('mountain')
    expect(normalizeForSearch('Island')).toBe('island')
  })

  it('handles empty string', () => {
    expect(normalizeForSearch('')).toBe('')
  })
})
