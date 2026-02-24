import { readFileSync, writeFileSync } from 'fs'

const file = 'd:/Desktop/Files/Card Search/group-buy/src/routes/import/+page.svelte'
let content = readFileSync(file, 'utf8')

// The broken part — origin was stripped, leaving just '\\/import#...'
// We replace it with the hardcoded production origin
const find = "\\/import#moxfield-import='+encodeURIComponent(t)+'&name='+name;"
const replace = "https://rons-group-buy.vercel.app/import#moxfield-import='+encodeURIComponent(t)+'&name='+name;"

if (content.includes(find)) {
  content = content.split(find).join(replace)
  writeFileSync(file, content)
  console.log('✓ Fixed bookmarklet href')
} else {
  // Debug: show the surrounding area  
  const idx = content.indexOf('location.href=')
  if (idx !== -1) {
    console.log('Current location.href region:', JSON.stringify(content.slice(idx, idx + 150)))
  }
  console.log('Pattern not found — may already be fixed')
}
