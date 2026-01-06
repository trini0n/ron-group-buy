import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate price based on card type
 * Normal & Holo: $1.25
 * Foil: $1.50
 */
export function getCardPrice(cardType: string): number {
  return cardType === 'Foil' ? 1.5 : 1.25;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Calculate cart total
 */
export function calculateCartTotal(
  items: Array<{ cardType: string; quantity: number }>
): number {
  return items.reduce((total, item) => {
    return total + getCardPrice(item.cardType) * item.quantity;
  }, 0);
}

/**
 * Determine card type from serial prefix
 * H- = Holo, N- = Normal, F- = Foil
 */
export function getCardTypeFromSerial(serial: string): 'Holo' | 'Normal' | 'Foil' {
  if (serial.startsWith('H-')) return 'Holo';
  if (serial.startsWith('F-')) return 'Foil';
  return 'Normal';
}

/**
 * Generate 17track.net tracking URL
 */
export function getTrackingUrl(trackingNumber: string): string {
  return `https://www.17track.net/?nums=${encodeURIComponent(trackingNumber)}`;
}

/**
 * Get Scryfall image URL from scryfall_id
 */
export function getScryfallImageUrl(
  scryfallId: string,
  size: 'small' | 'normal' | 'large' | 'png' = 'normal'
): string {
  // Scryfall image URL format: first char / second char / full id
  const a = scryfallId.charAt(0);
  const b = scryfallId.charAt(1);
  return `https://cards.scryfall.io/${size}/front/${a}/${b}/${scryfallId}.jpg`;
}

/**
 * Get the best available image URL for a card
 * Priority: Ron's Google Photos image > Scryfall
 */
export function getCardImageUrl(
  ronImageUrl: string | null,
  scryfallId: string | null,
  size: 'small' | 'normal' | 'large' = 'normal'
): string {
  if (ronImageUrl) {
    return ronImageUrl;
  }
  if (scryfallId) {
    return getScryfallImageUrl(scryfallId, size);
  }
  // Fallback placeholder
  return '/images/card-placeholder.png';
}
