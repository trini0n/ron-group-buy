import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculate price based on card type
 * Normal & Holo: $1.25
 * Foil: $1.50
 */
export function getCardPrice(cardType: string): number {
  return cardType === 'Foil' ? 1.5 : 1.25
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`
}

/**
 * Calculate cart total
 */
export function calculateCartTotal(items: Array<{ cardType: string; quantity: number }>): number {
  return items.reduce((total, item) => {
    return total + getCardPrice(item.cardType) * item.quantity
  }, 0)
}

/**
 * Determine card type from serial prefix
 * H- = Holo, N- = Normal, F- = Foil
 */
export function getCardTypeFromSerial(serial: string): 'Holo' | 'Normal' | 'Foil' {
  if (serial.startsWith('H-')) return 'Holo'
  if (serial.startsWith('F-')) return 'Foil'
  return 'Normal'
}

/**
 * Generate 17track.net tracking URL
 */
export function getTrackingUrl(trackingNumber: string): string {
  return `https://www.17track.net/?nums=${encodeURIComponent(trackingNumber)}`
}

/**
 * Get Scryfall image URL from scryfall_id
 */
export function getScryfallImageUrl(scryfallId: string, size: 'small' | 'normal' | 'large' | 'png' = 'normal'): string {
  // Scryfall image URL format: first char / second char / full id
  const a = scryfallId.charAt(0)
  const b = scryfallId.charAt(1)
  return `https://cards.scryfall.io/${size}/front/${a}/${b}/${scryfallId}.jpg`
}

/**
 * Check if Ron's image URL is a valid direct image URL (not a share page)
 */
export function isValidRonImageUrl(ronImageUrl: string | null): boolean {
  if (!ronImageUrl) return false
  // Only valid if it's a direct lh3.googleusercontent.com URL
  return (
    ronImageUrl.includes('lh3.googleusercontent.com') ||
    (!ronImageUrl.includes('photos.google.com/share') &&
      !ronImageUrl.includes('photos.app.goo.gl') &&
      !ronImageUrl.includes('photos.google.com'))
  )
}

/**
 * Get Ron's direct image URL if available
 */
export function getRonImageUrl(ronImageUrl: string | null): string | null {
  if (isValidRonImageUrl(ronImageUrl)) {
    return ronImageUrl
  }
  return null
}

/**
 * Get all available images for a card (for carousel display)
 * Returns array with Ron's image first (if available), then Scryfall
 */
export function getCardImages(
  ronImageUrl: string | null,
  scryfallId: string | null,
  size: 'small' | 'normal' | 'large' = 'normal'
): Array<{ url: string; label: string }> {
  const images: Array<{ url: string; label: string }> = []

  // Add Ron's image first if it's a valid direct URL
  const ronUrl = getRonImageUrl(ronImageUrl)
  if (ronUrl) {
    images.push({ url: ronUrl, label: "Ron's Proxy" })
  }

  // Add Scryfall image
  if (scryfallId) {
    images.push({ url: getScryfallImageUrl(scryfallId, size), label: 'Scryfall' })
  }

  // Fallback if no images
  if (images.length === 0) {
    images.push({ url: '/images/card-placeholder.png', label: 'Placeholder' })
  }

  return images
}

/**
 * Get the best available image URL for a card
 * Priority: Ron's direct image URL > Scryfall
 * Note: Google Photos sharing links (photos.google.com/share) don't work as direct image URLs
 */
export function getCardImageUrl(
  ronImageUrl: string | null,
  scryfallId: string | null,
  size: 'small' | 'normal' | 'large' = 'normal'
): string {
  // Only use Ron's URL if it's a direct image URL (lh3.googleusercontent.com)
  // Skip Google Photos share pages that haven't been converted yet
  if (isValidRonImageUrl(ronImageUrl)) {
    return ronImageUrl!
  }
  if (scryfallId) {
    return getScryfallImageUrl(scryfallId, size)
  }
  // Fallback placeholder
  return '/images/card-placeholder.png'
}

/**
 * Generate a URL-friendly slug from a card name
 * Example: "Wan Shi Tong, Librarian" -> "wan-shi-tong-librarian"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate the URL path for a card detail page
 * Format: /card/setCode/collectorsNum/card-name-slug/
 */
export function getCardUrl(card: {
  set_code: string | null
  collector_number: string | null
  card_name: string
}): string {
  const setCode = (card.set_code || 'unknown').toLowerCase()
  const collectorNum = card.collector_number || '0'
  const slug = slugify(card.card_name)
  return `/card/${setCode}/${collectorNum}/${slug}/`
}
