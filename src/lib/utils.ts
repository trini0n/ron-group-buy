import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`
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
 * Normalizes lh3.googleusercontent.com URLs to use high resolution
 */
export function getRonImageUrl(ronImageUrl: string | null): string | null {
  if (!isValidRonImageUrl(ronImageUrl) || !ronImageUrl) {
    return null
  }
  
  // For lh3.googleusercontent.com URLs, ensure high resolution
  if (ronImageUrl.includes('lh3.googleusercontent.com')) {
    // Remove existing size suffix (=w123, =s200, =w200-h300, etc.)
    let cleanUrl = ronImageUrl.replace(/=[wsh]\d+(-[wsh]\d+)*(-[a-zA-Z]+)*$/, '')
    // Also handle =w0 or other simple suffixes
    cleanUrl = cleanUrl.replace(/=\w+$/, '')
    // Append high resolution suffix (w1200 is a good balance of quality and load time)
    return cleanUrl + '=w1200'
  }
  
  return ronImageUrl
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
 * Check if a language code is a "default" language that doesn't need a URL segment
 * Default languages: English (en), Quenya (qya), Phyrexian (ph)
 * These are either primary English or fictional languages that use English text
 */
export function isDefaultLanguage(language: string | null | undefined): boolean {
  if (!language) return true // null/undefined treated as English
  const lang = language.toLowerCase()
  return lang === 'en' || lang === 'qya' || lang === 'ph'
}

/**
 * Generate the URL path for a card detail page
 * Format: /card/setCode/collectorsNum/card-name-slug/ (for default languages)
 * Format: /card/setCode/collectorsNum/lang/card-name-slug/ (for other languages)
 */
export function getCardUrl(card: {
  set_code: string | null
  collector_number: string | null
  card_name: string
  language?: string | null
}): string {
  const setCode = (card.set_code || 'unknown').toLowerCase()
  const collectorNum = card.collector_number || '0'
  const slug = slugify(card.card_name)
  
  // Only include language segment for non-default languages
  if (!isDefaultLanguage(card.language)) {
    const lang = card.language!.toLowerCase()
    return `/card/${setCode}/${collectorNum}/${lang}/${slug}/`
  }
  
  return `/card/${setCode}/${collectorNum}/${slug}/`
}

/**
 * Get the display label for a card's finish type
 */
export function getFinishLabel(card: { foil_type?: string | null; card_type: string }): string {
  return card.foil_type || card.card_type
}

/**
 * Get Tailwind CSS classes for finish badge styling
 * Works in both light and dark mode
 */
export function getFinishBadgeClasses(finish: string): string {
  switch (finish) {
    case 'Normal':
      // Gray - neutral, understated
      return 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200'
    case 'Holo':
      // Purple/Violet - represents holographic
      return 'bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-200'
    case 'Foil':
      // Amber/Gold - represents premium foil
      return 'bg-amber-200 text-amber-800 dark:bg-amber-700 dark:text-amber-100'
    case 'Surge Foil':
      // Cyan/Electric blue - represents special/surge effect
      return 'bg-cyan-200 text-cyan-800 dark:bg-cyan-700 dark:text-cyan-100'
    default:
      // Fallback to secondary
      return 'bg-secondary text-secondary-foreground'
  }
}

/**
 * Get the frame effect label for a card from its boolean flags
 * Returns null if no special frame effect
 * Note: Showcase supersedes Borderless (if both are true, only show Showcase)
 */
export function getFrameEffectLabel(card: {
  is_retro?: boolean | null
  is_extended?: boolean | null
  is_showcase?: boolean | null
  is_borderless?: boolean | null
  is_etched?: boolean | null
} | null): string | null {
  if (!card) return null
  
  const effects: string[] = []
  if (card.is_retro) effects.push('Retro')
  if (card.is_extended) effects.push('Extended Art')
  if (card.is_showcase) effects.push('Showcase')
  // Only show Borderless if Showcase is NOT present (Showcase supersedes Borderless)
  if (card.is_borderless && !card.is_showcase) effects.push('Borderless')
  if (card.is_etched) effects.push('Etched')
  
  return effects.length > 0 ? effects.join(', ') : null
}

