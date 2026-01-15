import type { ParamMatcher } from '@sveltejs/kit'

/**
 * Matches 2-3 character ISO language codes (lowercase)
 * Examples: en, ja, zh, de, fr, pt, es, it, ko, ru
 */
export const match: ParamMatcher = (param) => {
  // Language codes are 2-3 lowercase letters
  // This distinguishes them from slugs which contain hyphens
  return /^[a-z]{2,3}$/.test(param)
}
