// Run with: node scripts/test-moxfield.mjs <moxfield-url>
// e.g.  node scripts/test-moxfield.mjs https://moxfield.com/decks/P2IiSui_r0mkt5Ptm-nsxQ

const url = process.argv[2] ?? 'https://moxfield.com/decks/P2IiSui_r0mkt5Ptm-nsxQ'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.moxfield.com/',
  Origin: 'https://www.moxfield.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'Cache-Control': 'no-cache',
}

const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/)
if (!match) { console.error('Bad URL'); process.exit(1) }
const publicId = match[1]

console.log(`\n=== Moxfield Import Debug ===`)
console.log(`URL:      ${url}`)
console.log(`publicId: ${publicId}\n`)

// ── Step 1: v3 JSON ──────────────────────────────────────────────────────────
console.log('▶ Step 1: GET /v3/decks/all/' + publicId)
let exportId = null
let deckName = null
try {
  const r = await fetch(`https://api2.moxfield.com/v3/decks/all/${publicId}`, { headers: HEADERS })
  console.log(`  status : ${r.status} ${r.statusText}`)
  console.log(`  headers: cf-ray=${r.headers.get('cf-ray')} | server=${r.headers.get('server')}`)

  if (r.ok) {
    const body = await r.json()
    deckName  = body.name
    exportId  = body.exportId
    const cardCount = Object.values(body.boards ?? {}).reduce((n, b) => n + (b.count ?? 0), 0)
    console.log(`  ✓ name="${deckName}" exportId=${exportId} totalCards=${cardCount}`)
  } else {
    const text = await r.text()
    console.log(`  ✗ body (first 300 chars): ${text.slice(0, 300)}`)
  }
} catch (err) {
  console.log(`  ✗ fetch threw: ${err.message}`)
}

// ── Step 2: export endpoint ───────────────────────────────────────────────────
if (exportId) {
  console.log(`\n▶ Step 2: GET /v2/decks/all/${publicId}/export?exportId=${exportId}`)
  try {
    const r = await fetch(
      `https://api2.moxfield.com/v2/decks/all/${publicId}/export?exportId=${exportId}`,
      { headers: { ...HEADERS, Accept: 'text/plain, */*' } }
    )
    console.log(`  status : ${r.status} ${r.statusText}`)
    if (r.ok) {
      const text = await r.text()
      const lines = text.split('\n').filter(l => l.trim())
      console.log(`  ✓ ${lines.length} lines. First 5:`)
      lines.slice(0, 5).forEach(l => console.log(`    ${l}`))
    } else {
      const text = await r.text()
      console.log(`  ✗ body (first 300 chars): ${text.slice(0, 300)}`)
    }
  } catch (err) {
    console.log(`  ✗ fetch threw: ${err.message}`)
  }
} else {
  console.log('\n⚠ Skipping Step 2 — no exportId obtained from Step 1')
}

// ── Step 3: v2 JSON fallback ──────────────────────────────────────────────────
console.log(`\n▶ Step 3 (fallback): GET /v2/decks/all/${publicId}`)
try {
  const r = await fetch(`https://api2.moxfield.com/v2/decks/all/${publicId}`, { headers: HEADERS })
  console.log(`  status : ${r.status} ${r.statusText}`)
  if (r.ok) {
    const body = await r.json()
    const cardCount = Object.values(body.boards ?? {}).reduce((n, b) => n + (b.count ?? 0), 0)
    console.log(`  ✓ name="${body.name}" totalCards=${cardCount}`)
  } else {
    const text = await r.text()
    console.log(`  ✗ body (first 300 chars): ${text.slice(0, 300)}`)
  }
} catch (err) {
  console.log(`  ✗ fetch threw: ${err.message}`)
}

console.log('\n=== Done ===')
