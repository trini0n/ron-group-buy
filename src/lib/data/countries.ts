import { allCountries } from 'country-telephone-data'

export type CountryConfig = {
  iso2: string
  name: string
  dialCode: string
  flag: string
}

function iso2ToFlag(iso2: string): string {
  return [...iso2.toUpperCase()].map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
}

// Strip parenthetical native-script annotations e.g. "Afghanistan (‫افغانستان‬‎)" → "Afghanistan"
function cleanName(name: string): string {
  return name.replace(/\s*\(.*?\)\s*/g, '').trim()
}

export const countries: CountryConfig[] = allCountries.map((c) => ({
  iso2: c.iso2.toUpperCase(),
  name: cleanName(c.name),
  dialCode: `+${c.dialCode}`,
  flag: iso2ToFlag(c.iso2)
}))

// Helper to look up country data by full name, alias, or ISO-2 code
export function getCountryByName(name: string): CountryConfig | undefined {
  if (!name) return undefined

  // Normalize checking to handle variations (USA, UK, etc)
  const normalized = name.toUpperCase().trim()

  const aliases: Record<string, string> = {
    USA: 'US',
    'UNITED STATES': 'US',
    'UNITED KINGDOM': 'GB',
    UK: 'GB',
    'SOUTH KOREA': 'KR'
  }

  const targetIso = aliases[normalized]
  if (targetIso) {
    return countries.find((c) => c.iso2 === targetIso)
  }

  // Check direct iso2 match (e.g. 'US', 'CA', 'GB')
  const byIso2 = countries.find((c) => c.iso2 === normalized)
  if (byIso2) return byIso2

  return countries.find((c) => c.name.toUpperCase() === normalized)
}
