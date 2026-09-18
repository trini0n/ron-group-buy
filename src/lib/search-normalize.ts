/**
 * Normalize a string for search comparison.
 *
 * Strips diacritics (ú → u, û → u, é → e, etc.), replaces hyphens and
 * punctuation with spaces, collapses whitespace, lowercases, and trims.
 *
 * This lets users search "anduril" and match "Andúril", or "nazgul" and
 * match "Nazgûl".
 *
 * Uses Unicode NFD decomposition to separate base characters from combining
 * marks, then strips the marks. Works in all modern JS runtimes.
 */
export function normalizeForSearch(text: string): string {
  return (
    text
      // Decompose accented characters into base + combining marks
      .normalize('NFD')
      // Strip combining diacritical marks (U+0300–U+036F)
      .replace(/[\u0300-\u036f]/g, '')
      // Replace hyphens, en-dashes, em-dashes, quotes (straight + curly), and other punctuation with space
      .replace(/[-\u2013\u2014\u2018\u2019\u201c\u201d'",.!?:;()[\]{}/\\]/g, ' ')
      // Collapse multiple spaces into one
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim()
  )
}
