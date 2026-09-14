/**
 * Smart Search Utilities for Admin Pages
 *
 * Auto-detects the type of search input and returns the appropriate
 * Supabase filter string. Detection priority:
 *   1. Email       — contains '@'
 *   2. Discord UID — 17-18 digit numeric string
 *   3. Name        — contains a space (Firstname Lastname)
 *   4. Discord username — fallback (single word, not matching above)
 */

export type SearchType = 'email' | 'discord_uid' | 'name' | 'discord_username'

/**
 * Classify a raw search string into a search type.
 */
export function classifySearch(query: string): SearchType {
  const trimmed = query.trim()

  // Email: contains an '@'
  if (trimmed.includes('@')) {
    return 'email'
  }

  // Discord UID: exactly 17 or 18 digits
  if (/^\d{17,18}$/.test(trimmed)) {
    return 'discord_uid'
  }

  // Name: contains a space (e.g. "John Doe")
  if (trimmed.includes(' ')) {
    return 'name'
  }

  // Fallback: treat as Discord username
  return 'discord_username'
}

/**
 * Build a Supabase `.or()` filter string for searching users directly.
 *
 * Depending on the detected type, this narrows the filter to the most
 * relevant column(s) instead of doing a blanket search across all fields.
 */
export function buildUserSearchFilter(query: string): string {
  const trimmed = query.trim()
  const type = classifySearch(trimmed)

  switch (type) {
    case 'email':
      return `email.ilike.%${trimmed}%`
    case 'discord_uid':
      return `discord_id.eq.${trimmed}`
    case 'name':
      return `name.ilike.%${trimmed}%`
    case 'discord_username':
      // Fallback: search username, name, and email to be generous
      return `discord_username.ilike.%${trimmed}%,name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`
  }
}
