/**
 * Google Photos URL Converter (Server-side)
 *
 * Converts Google Photos sharing URLs to direct image URLs (lh3.googleusercontent.com)
 * Based on: https://github.com/kalabic/get-gphoto-url
 *
 * Supports:
 *   - https://photos.google.com/share/...
 *   - https://photos.app.goo.gl/...
 */

const GOOGLE_CONTENT_PREFIX = 'https://lh3.googleusercontent.com/'

/**
 * Extract direct image URL from a Google Photos sharing page
 */
export async function getDirectPhotoUrl(shareUrl: string): Promise<string | null> {
  // Skip if already a direct URL
  if (shareUrl.startsWith(GOOGLE_CONTENT_PREFIX)) {
    return shareUrl
  }

  // Only process Google Photos URLs
  if (!shareUrl.includes('photos.google.com/share') && !shareUrl.includes('photos.app.goo.gl')) {
    return null
  }

  try {
    const response = await fetch(shareUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.error(`Failed to fetch ${shareUrl}: ${response.status}`)
      return null
    }

    const html = await response.text()

    // Look for lh3.googleusercontent.com URLs in the page
    // Pattern: content="https://lh3.googleusercontent.com/..." or similar
    const regex = new RegExp(`${GOOGLE_CONTENT_PREFIX}[A-Za-z0-9/_=-]+`, 'g')
    const matches = html.match(regex)

    if (!matches || matches.length === 0) {
      console.error(`No direct URL found in ${shareUrl}`)
      return null
    }

    // Get the first match and normalize it
    let directUrl = matches[0]

    // Remove any size suffix (=w123-h456 or similar) and set to original size (=w0)
    const sizeIndex = directUrl.indexOf('=w')
    if (sizeIndex > 0) {
      directUrl = directUrl.substring(0, sizeIndex)
    }

    // Append =w0 for original size
    directUrl += '=w0'

    return directUrl
  } catch (error) {
    console.error(`Error converting ${shareUrl}:`, error)
    return null
  }
}

/**
 * Convert URLs with rate limiting to avoid being blocked
 */
export async function convertUrlsWithRateLimit(
  urls: (string | null)[],
  delayMs: number = 200
): Promise<(string | null)[]> {
  const results: (string | null)[] = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]

    if (!url) {
      results.push(null)
      continue
    }

    // Skip non-Google Photos URLs
    if (!url.includes('photos.google.com') && !url.includes('photos.app.goo.gl')) {
      results.push(url)
      continue
    }

    const directUrl = await getDirectPhotoUrl(url)
    results.push(directUrl)

    // Rate limit
    if (i < urls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return results
}
