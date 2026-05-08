export const ORACLE_TAGS: Record<string, readonly string[]> = {
  shockland: [
    'Blood Crypt', 'Breeding Pool', 'Godless Shrine', 'Hallowed Fountain',
    'Overgrown Tomb', 'Sacred Foundry', 'Steam Vents', 'Stomping Ground',
    'Temple Garden', 'Watery Grave',
  ],
  fetchland: [
    'Arid Mesa', 'Bloodstained Mire', 'Flooded Strand', 'Marsh Flats',
    'Misty Rainforest', 'Polluted Delta', 'Scalding Tarn', 'Verdant Catacombs',
    'Windswept Heath', 'Wooded Foothills',
  ],
  checkland: [
    'Clifftop Retreat', 'Dragonskull Summit', 'Drowned Catacomb', 'Glacial Fortress',
    'Hinterland Harbor', 'Isolated Chapel', 'Rootbound Crag', 'Sulfur Falls',
    'Sunpetal Grove', 'Woodland Cemetery',
  ],
  fastland: [
    'Blackcleave Cliffs', 'Blooming Marsh', 'Botanical Sanctum', 'Concealed Courtyard',
    'Copperline Gorge', 'Darkslick Shores', 'Inspiring Vantage', 'Razorverge Thicket',
    'Seachrome Coast', 'Spirebluff Canal',
  ],
  painland: [
    'Adarkar Wastes', 'Battlefield Forge', 'Brushland', 'Caves of Koilos',
    'Karplusan Forest', 'Llanowar Wastes', 'Shivan Reef', 'Sulfurous Springs',
    'Underground River', 'Yavimaya Coast',
  ],
  scryland: [
    'Temple of Abandon', 'Temple of Deceit', 'Temple of Enlightenment', 'Temple of Epiphany',
    'Temple of Malady', 'Temple of Malice', 'Temple of Mystery', 'Temple of Plenty',
    'Temple of Silence', 'Temple of Triumph',
  ],
  vergeland: ['Canopy Vista', 'Cinder Glade', 'Prairie Stream', 'Smoldering Marsh', 'Sunken Hollow'],
  bounceland: [
    'Azorius Chancery', 'Boros Garrison', 'Dimir Aqueduct', 'Golgari Rot Farm',
    'Gruul Turf', 'Izzet Boilerworks', 'Orzhov Basilica', 'Rakdos Carnarium',
    'Selesnya Sanctuary', 'Simic Growth Chamber',
  ],
  filterland: [
    'Cascade Bluffs', 'Fetid Heath', 'Fire-Lit Thicket', 'Flooded Grove',
    'Graven Cairns', 'Mystic Gate', 'Rugged Prairie', 'Sunken Ruins',
    'Twilight Mire', 'Wooded Bastion',
  ],
  triome: [
    'Indatha Triome', 'Ketria Triome', 'Raugrin Triome', 'Savai Triome', 'Zagoth Triome',
    "Jetmir's Garden", "Raffine's Tower", "Spara's Headquarters",
    "Xander's Lounge", "Ziatora's Proving Ground",
  ],
  bondland: [
    'Bountiful Promenade', 'Luxury Suite', 'Morphic Pool', 'Rejuvenating Springs',
    'Sea of Clouds', 'Spectator Seating', 'Spire Garden', 'Training Center',
    'Undergrowth Stadium', 'Vault of Champions',
  ],
  slowland: [
    'Deathcap Glade', 'Deserted Beach', 'Haunted Ridge', 'Rockfall Vale', 'Shipwreck Marsh',
    'Overgrown Farmland', 'Shattered Sanctum', 'Stormcarved Coast', 'Sundown Pass', 'Vineglimmer Snarl',
  ],
  canopyland: [
    'Fiery Islet', 'Horizon Canopy', 'Nurturing Peatland', 'Silent Clearing',
    'Sunbaked Canyon', 'Waterlogged Grove',
  ],
  bicycle: ['Canyon Slough', 'Fetid Pools', 'Irrigated Farmland', 'Scattered Groves', 'Sheltered Thicket'],
  manland: [
    'Celestial Colonnade', 'Creeping Tar Pit', 'Lavaclaw Reaches', 'Raging Ravine', 'Stirring Wildwood',
    'Hissing Quagmire', 'Lumbering Falls', 'Needle Spires', 'Shambling Vent', 'Wandering Fumarole',
  ],
  basicland: [
    'Forest', 'Island', 'Mountain', 'Plains', 'Swamp',
    'Snow-Covered Forest', 'Snow-Covered Island', 'Snow-Covered Mountain',
    'Snow-Covered Plains', 'Snow-Covered Swamp', 'Wastes',
  ],
}

export const ORACLE_TAG_LABELS: Record<string, string> = {
  shockland: 'Shock Land', fetchland: 'Fetch Land', checkland: 'Check Land',
  fastland: 'Fast Land', painland: 'Pain Land', scryland: 'Scry Land',
  vergeland: 'Verge Land', bounceland: 'Bounce Land', filterland: 'Filter Land',
  triome: 'Triome', bondland: 'Bond Land', slowland: 'Slow Land',
  canopyland: 'Canopy Land', bicycle: 'Bicycle Land', manland: 'Creature Land',
  basicland: 'Basic Land',
}

export function matchesOracleTag(cardName: string, tag: string): boolean {
  const cardNames = ORACLE_TAGS[tag.toLowerCase()]
  if (!cardNames) return false
  const normalizedName = cardName.toLowerCase()
  return cardNames.some((name) => name.toLowerCase() === normalizedName)
}
