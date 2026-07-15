<script lang="ts">
  import { Label } from '$components/ui/label'
  import { Checkbox } from '$components/ui/checkbox'
  import { Button } from '$components/ui/button'
  import * as Popover from '$components/ui/popover'
  import * as Command from '$components/ui/command'
  import * as Accordion from '$components/ui/accordion'
  import * as Select from '$components/ui/select'
  import ManaIcon from '$lib/components/icons/ManaIcon.svelte'
  import { X, ChevronsUpDown, Check, ChevronDown, Filter, Info } from 'lucide-svelte'
  import { browser } from '$app/environment'
  import * as Tooltip from '$components/ui/tooltip'
  import type { SortBy } from '$lib/components/cards/CardGrid.svelte'
  import { getLanguageLabel } from '$lib/utils'

  interface Set {
    code: string
    name: string
  }

  interface Filters {
    setCodes: string[]
    colorIdentity: string[]
    colorIdentityStrict: boolean
    priceCategories: string[]
    foilSubtypes: string[]
    nonFoilSubtypes: string[]
    cardTypes: string[]
    frameTypes: string[]
    inStockOnly: boolean
    isNew: boolean
    isMisprint: boolean
    languages: string[]
  }

  interface Props {
    filters: Filters
    sets: Set[]
    foilSubtypeOptions?: Array<{ value: string; label: string }>
    languageOptions?: string[]
    sortBy?: SortBy
    onClearAll?: () => void
  }

  let { filters = $bindable(), sets, foilSubtypeOptions = [], languageOptions = [], sortBy = $bindable('name-asc'), onClearAll }: Props = $props()

  // Sort options matching the dropdown in the screenshot
  const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
    { value: 'name-asc',       label: 'Name (A\u2192Z)' },
    { value: 'name-desc',      label: 'Name (Z\u2192A)' },
    { value: 'price-asc',      label: 'Price (Market \u2191)' },
    { value: 'price-desc',     label: 'Price (Market \u2193)' },
    { value: 'release-newest', label: 'Release Date (Newest)' },
    { value: 'release-oldest', label: 'Release Date (Oldest)' },
    { value: 'set-collector',  label: 'Set + Collector #' }
  ]

  const sortLabel = $derived(SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Name (A\u2192Z)')

  // Combobox state
  let setComboboxOpen = $state(false)
  let setSearchValue = $state('')
  let langComboboxOpen = $state(false)

  // Mobile accordion state - collapsed by default on mobile
  let isMobile = $state(false)
  let mobileFiltersOpen = $state(false)

  // Check screen size on mount and resize
  $effect(() => {
    if (!browser) return

    const checkMobile = () => {
      isMobile = window.innerWidth < 1024 // lg breakpoint
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  })

  const colors: Array<{ value: 'W' | 'U' | 'B' | 'R' | 'G' | 'C'; label: string }> = [
    { value: 'W', label: 'White' },
    { value: 'U', label: 'Blue' },
    { value: 'B', label: 'Black' },
    { value: 'R', label: 'Red' },
    { value: 'G', label: 'Green' },
    { value: 'C', label: 'Colorless' }
  ]

  // Top-level finish categories
  const priceCategories = [
    { value: 'Non-Foil', label: 'Non-Foil' },
    { value: 'Foil', label: 'Foil' },
    { value: 'Serialized', label: 'Serialized' }
  ]

  // Foil subtypes — driven by foilSubtypeOptions prop (derived from card data upstream)

  // Non-Foil subtypes — only visible when 'Non-Foil' is checked
  // Labels match the badge text shown on cards in the catalog
  const NON_FOIL_SUBTYPES = [
    { value: 'Normal', label: 'Normal' },
    { value: 'Holo', label: 'Holo' }
  ]

  // Whether the Foil subtype panel is relevant
  const foilSelected = $derived(filters.priceCategories.includes('Foil'))
  // Whether all subtypes are selected (used for the 'all' indicator)
  const allFoilSubtypesSelected = $derived(filters.foilSubtypes.length === foilSubtypeOptions.length)

  // Whether the Non-Foil subtype panel is relevant
  const nonFoilSelected = $derived(filters.priceCategories.includes('Non-Foil'))
  // Whether all non-foil subtypes are selected
  const allNonFoilSubtypesSelected = $derived(filters.nonFoilSubtypes.length === NON_FOIL_SUBTYPES.length)

  const cardTypes = ['Land', 'Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle', 'Instant', 'Sorcery']

  const frameTypes = [
    { value: 'retro', label: 'Retro' },
    { value: 'extended', label: 'Extended Art' },
    { value: 'borderless', label: 'Full Art (Borderless)' },
    { value: 'showcase', label: 'Showcase' }
  ]

  function toggleCardType(type: string) {
    if (filters.cardTypes.includes(type)) {
      filters.cardTypes = filters.cardTypes.filter((t) => t !== type)
    } else {
      filters.cardTypes = [...filters.cardTypes, type]
    }
  }

  function togglePriceCategory(category: string) {
    if (filters.priceCategories.includes(category)) {
      filters.priceCategories = filters.priceCategories.filter((c) => c !== category)
    } else {
      filters.priceCategories = [...filters.priceCategories, category]
      // When Foil is re-enabled, restore all subtypes so nothing is hidden
      if (category === 'Foil') {
        filters.foilSubtypes = foilSubtypeOptions.map((s) => s.value)
      }
      // When Non-Foil is re-enabled, restore all non-foil subtypes
      if (category === 'Non-Foil') {
        filters.nonFoilSubtypes = NON_FOIL_SUBTYPES.map((s) => s.value)
      }
    }
  }

  function toggleFoilSubtype(subtype: string) {
    if (filters.foilSubtypes.includes(subtype)) {
      filters.foilSubtypes = filters.foilSubtypes.filter((s) => s !== subtype)
    } else {
      filters.foilSubtypes = [...filters.foilSubtypes, subtype]
    }
  }

  function toggleNonFoilSubtype(subtype: string) {
    if (filters.nonFoilSubtypes.includes(subtype)) {
      filters.nonFoilSubtypes = filters.nonFoilSubtypes.filter((s) => s !== subtype)
    } else {
      filters.nonFoilSubtypes = [...filters.nonFoilSubtypes, subtype]
    }
  }

  function toggleFrameType(frame: string) {
    if (filters.frameTypes.includes(frame)) {
      filters.frameTypes = filters.frameTypes.filter((f) => f !== frame)
    } else {
      filters.frameTypes = [...filters.frameTypes, frame]
    }
  }

  // Whether all languages are selected
  const allLanguagesSelected = $derived(filters.languages.length === languageOptions.length)

  function toggleLanguage(lang: string) {
    if (filters.languages.includes(lang)) {
      filters.languages = filters.languages.filter((l) => l !== lang)
    } else {
      filters.languages = [...filters.languages, lang]
    }
  }

  // Language selector label
  const selectedLangLabel = $derived.by(() => {
    if (filters.languages.length === 0 || allLanguagesSelected) return 'All Languages'
    if (filters.languages.length === 1) return getLanguageLabel(filters.languages[0]!)
    return `${filters.languages.length} languages`
  })

  function clearLangSelection() {
    filters.languages = [...languageOptions]
  }

  function toggleColor(color: string) {
    if (filters.colorIdentity.includes(color)) {
      filters.colorIdentity = filters.colorIdentity.filter((c) => c !== color)
    } else {
      filters.colorIdentity = [...filters.colorIdentity, color]
    }
  }

  function clearFilters() {
    filters.setCodes = []
    filters.colorIdentity = []
    filters.colorIdentityStrict = true
    filters.priceCategories = ['Non-Foil', 'Foil', 'Serialized']
    filters.foilSubtypes = foilSubtypeOptions.map((s) => s.value)
    filters.nonFoilSubtypes = NON_FOIL_SUBTYPES.map((s) => s.value)
    filters.cardTypes = []
    filters.frameTypes = []
    filters.languages = [...languageOptions]
    filters.inStockOnly = false
    filters.isNew = false
    filters.isMisprint = false
    onClearAll?.()
  }

  function toggleSetCode(code: string) {
    // Allow multi-select: toggle the set
    if (filters.setCodes.length === 1 && filters.setCodes[0] === code.toLowerCase()) {
      filters.setCodes = []
    } else if (filters.setCodes.includes(code.toLowerCase())) {
      filters.setCodes = filters.setCodes.filter((c) => c !== code.toLowerCase())
    } else {
      filters.setCodes = [...filters.setCodes, code.toLowerCase()]
    }
  }

  function clearSetSelection() {
    filters.setCodes = []
    setSearchValue = ''
  }

  const hasActiveFilters = $derived(
    filters.setCodes.length > 0 ||
      filters.colorIdentity.length > 0 ||
      filters.priceCategories.length < 3 ||
      (foilSelected && !allFoilSubtypesSelected) ||
      (nonFoilSelected && !allNonFoilSubtypesSelected) ||
      filters.cardTypes.length > 0 ||
      filters.frameTypes.length > 0 ||
      filters.inStockOnly ||
      filters.isNew ||
      filters.isMisprint
  )

  // Get display labels for selects
  const selectedSetLabel = $derived.by(() => {
    if (filters.setCodes.length === 0) return 'All Sets'
    if (filters.setCodes.length === 1) {
      const set = sets.find((s) => s.code.toLowerCase() === filters.setCodes[0])
      return set ? `${set.name}` : 'All Sets'
    }
    return `${filters.setCodes.length} sets selected`
  })

  // Filter sets based on search
  const filteredSets = $derived.by(() => {
    if (!setSearchValue) return sets
    const query = setSearchValue.toLowerCase()
    return sets.filter((set) => set.name.toLowerCase().includes(query) || set.code.toLowerCase().includes(query))
  })

  // Count active filters for badge
  const activeFilterCount = $derived.by(() => {
    let count = 0
    if (filters.setCodes.length > 0) count++
    if (filters.colorIdentity.length > 0) count++
    if (
      filters.priceCategories.length < 3 ||
      (foilSelected && !allFoilSubtypesSelected) ||
      (nonFoilSelected && !allNonFoilSubtypesSelected)
    )
      count++
    if (filters.cardTypes.length > 0) count++
    if (filters.frameTypes.length > 0) count++
    if (filters.inStockOnly) count++
    if (filters.isNew) count++
    if (filters.isMisprint) count++
    return count
  })
</script>

<div class="space-y-4 rounded-lg border bg-card p-4">
  <!-- Header with toggle for mobile - entire bar is clickable -->
  <div
    class="flex cursor-pointer items-center justify-between lg:cursor-default"
    onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}
    onkeydown={(e) => e.key === 'Enter' && (mobileFiltersOpen = !mobileFiltersOpen)}
    role="button"
    tabindex="0"
  >
    <div class="flex items-center gap-2 font-semibold">
      <Filter class="h-4 w-4 lg:hidden" />
      <span>Filters</span>
      {#if activeFilterCount > 0}
        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {activeFilterCount}
        </span>
      {/if}
      <ChevronDown class="h-4 w-4 transition-transform lg:hidden {mobileFiltersOpen ? 'rotate-180' : ''}" />
    </div>
    {#if hasActiveFilters}
      <Button
        variant="ghost"
        size="sm"
        onclick={(e: MouseEvent) => {
          e.stopPropagation()
          clearFilters()
        }}
      >
        <X class="mr-1 h-3 w-3" />
        Clear
      </Button>
    {/if}
  </div>

  <!-- Filter content - collapsible on mobile -->
  <div class="space-y-6 {isMobile && !mobileFiltersOpen ? 'hidden' : ''}">

    <!-- Sort By -->
    <div class="space-y-2">
      <Label for="sort-by-select">Sort By</Label>
      <Select.Root type="single" value={sortBy} onValueChange={(v) => { if (v) sortBy = v as typeof sortBy }}>
        <Select.Trigger id="sort-by-select" class="w-full">
          {sortLabel}
        </Select.Trigger>
        <Select.Content>
          {#each SORT_OPTIONS as option (option.value)}
            <Select.Item value={option.value} label={option.label}>
              {option.label}
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <!-- Set Filter - Multiselect Combobox -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label>Set</Label>
        {#if filters.setCodes.length > 0}
          <Button variant="ghost" size="sm" class="h-auto py-0 px-1 text-xs" onclick={clearSetSelection}>Clear</Button>
        {/if}
      </div>
      <Popover.Root bind:open={setComboboxOpen}>
        <Popover.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="outline"
              class="w-full justify-between"
              role="combobox"
              aria-expanded={setComboboxOpen}
            >
              <span class="truncate">{selectedSetLabel}</span>
              <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content class="w-[300px] p-0" align="start">
          <Command.Root shouldFilter={false}>
            <Command.Input placeholder="Search sets..." bind:value={setSearchValue} />
            <Command.List>
              <Command.Empty>No sets found.</Command.Empty>
              <Command.Group>
                {#each filteredSets as set}
                  <Command.Item value={set.code} onSelect={() => toggleSetCode(set.code)}>
                    <div class="flex w-full items-center">
                      <Check
                        class="mr-2 h-4 w-4 flex-shrink-0 {filters.setCodes.includes(set.code.toLowerCase())
                          ? 'opacity-100'
                          : 'opacity-0'}"
                      />
                      <span
                        class="mr-2 inline-block w-10 flex-shrink-0 text-right font-mono text-xs uppercase text-muted-foreground"
                        >{set.code}</span
                      >
                      <span class="min-w-0 flex-1 truncate">{set.name}</span>
                    </div>
                  </Command.Item>
                {/each}
              </Command.Group>
            </Command.List>
          </Command.Root>
        </Popover.Content>
      </Popover.Root>
    </div>

    <!-- Color Identity Filter -->
    <div class="space-y-2">
      <Label>Color Identity</Label>
      <div class="flex gap-2">
        {#each colors as color}
          <button
            type="button"
            aria-label="{color.label}{filters.colorIdentity.includes(color.value) ? ' (selected)' : ''}"
            aria-pressed={filters.colorIdentity.includes(color.value)}
            class="relative rounded-full transition-all {filters.colorIdentity.includes(color.value)
              ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              : 'opacity-60 hover:opacity-100'}"
            onclick={() => toggleColor(color.value)}
          >
            <ManaIcon color={color.value} size={32} />
          </button>
        {/each}
      </div>
      {#if filters.colorIdentity.length > 0}
        <div class="mt-3 flex overflow-hidden rounded-md border border-border text-sm" role="group" aria-label="Color matching mode">
          <button
            type="button"
            aria-label="Only these colors — cards must fit entirely within the selected colors"
            aria-pressed={filters.colorIdentityStrict}
            class="flex-1 px-3 py-1 transition-colors {filters.colorIdentityStrict
              ? 'bg-foreground text-background font-medium'
              : 'bg-transparent text-muted-foreground hover:text-foreground'}"
            onclick={() => (filters.colorIdentityStrict = true)}
          >
            Only
          </button>
          <button
            type="button"
            aria-label="Any of these colors — cards that include at least one selected color"
            aria-pressed={!filters.colorIdentityStrict}
            class="flex-1 border-l border-border px-3 py-1 transition-colors {!filters.colorIdentityStrict
              ? 'bg-foreground text-background font-medium'
              : 'bg-transparent text-muted-foreground hover:text-foreground'}"
            onclick={() => (filters.colorIdentityStrict = false)}
          >
            Any of
          </button>
        </div>
      {/if}
    </div>

    <!-- Card Type, Finish, Frame Type — collapsible accordion -->
    <Accordion.Root type="multiple" value={['card-type', 'finish', 'frame-type']}>
      <!-- Card Types (Type Line) - Multiselect with OR logic -->
      <Accordion.Item value="card-type">
        <Accordion.Trigger class="py-2 text-sm font-medium">Card Type</Accordion.Trigger>
        <Accordion.Content>
          <div class="flex flex-col gap-2 pt-1 pb-2">
            {#each cardTypes as type}
              <label class="flex cursor-pointer items-center space-x-2">
                <Checkbox checked={filters.cardTypes.includes(type)} onCheckedChange={() => toggleCardType(type)} />
                <span class="text-sm">{type}</span>
              </label>
            {/each}
          </div>
        </Accordion.Content>
      </Accordion.Item>

      <!-- Finish (card_type column) - 3 top-level categories + foil subtypes -->
      <Accordion.Item value="finish">
        <Accordion.Trigger class="py-2 text-sm font-medium">Finish</Accordion.Trigger>
        <Accordion.Content>
          <div class="space-y-2 pt-1 pb-2">
            {#each priceCategories as category}
              <label class="flex cursor-pointer items-center space-x-2">
                <Checkbox
                  checked={filters.priceCategories.includes(category.value)}
                  onCheckedChange={() => togglePriceCategory(category.value)}
                />
                <span class="text-sm">{category.label}</span>
              </label>
              {#if category.value === 'Non-Foil' && nonFoilSelected}
                <!-- Non-Foil subtypes — indented under the Non-Foil checkbox -->
                <div class="ml-6 space-y-1.5 border-l border-border pl-3">
                  {#each NON_FOIL_SUBTYPES as sub}
                    <label class="flex cursor-pointer items-center space-x-2">
                      <Checkbox
                        checked={filters.nonFoilSubtypes.includes(sub.value)}
                        onCheckedChange={() => toggleNonFoilSubtype(sub.value)}
                      />
                      <span class="text-xs text-muted-foreground">{sub.label}</span>
                    </label>
                  {/each}
                </div>
              {/if}
              {#if category.value === 'Foil' && foilSelected}
                <!-- Foil subtypes — indented under the Foil checkbox -->
                <div class="ml-6 space-y-1.5 border-l border-border pl-3">
                  {#each foilSubtypeOptions as sub}
                    <label class="flex cursor-pointer items-center space-x-2">
                      <Checkbox
                        checked={filters.foilSubtypes.includes(sub.value)}
                        onCheckedChange={() => toggleFoilSubtype(sub.value)}
                      />
                      <span class="text-xs text-muted-foreground">{sub.label}</span>
                    </label>
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        </Accordion.Content>
      </Accordion.Item>

      <!-- Frame Type Filter -->
      <Accordion.Item value="frame-type">
        <Accordion.Trigger class="py-2 text-sm font-medium">Frame Type</Accordion.Trigger>
        <Accordion.Content>
          <div class="space-y-2 pt-1 pb-2">
            {#each frameTypes as frame}
              <label class="flex cursor-pointer items-center space-x-2">
                <Checkbox
                  checked={filters.frameTypes.includes(frame.value)}
                  onCheckedChange={() => toggleFrameType(frame.value)}
                />
                <span class="text-sm">{frame.label}</span>
              </label>
            {/each}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>

    <!-- Language Filter — Multiselect Dropdown -->
    {#if languageOptions.length > 1}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label>Language</Label>
          {#if !allLanguagesSelected}
            <Button variant="ghost" size="sm" class="h-auto py-0 px-1 text-xs" onclick={clearLangSelection}>Clear</Button>
          {/if}
        </div>
        <Popover.Root bind:open={langComboboxOpen}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="outline"
                class="w-full justify-between"
                role="combobox"
                aria-expanded={langComboboxOpen}
              >
                <span class="truncate">{selectedLangLabel}</span>
                <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Content class="w-[220px] p-0" align="start">
            <Command.Root>
              <Command.List>
                <Command.Group>
                  {#each languageOptions as lang}
                    <Command.Item value={lang} onSelect={() => toggleLanguage(lang)}>
                      <div class="flex w-full items-center">
                        <Check
                          class="mr-2 h-4 w-4 flex-shrink-0 {filters.languages.includes(lang)
                            ? 'opacity-100'
                            : 'opacity-0'}"
                        />
                        <span class="min-w-0 flex-1 truncate">{getLanguageLabel(lang)}</span>
                      </div>
                    </Command.Item>
                  {/each}
                </Command.Group>
              </Command.List>
            </Command.Root>
          </Popover.Content>
        </Popover.Root>
      </div>
    {/if}

    <!-- Toggles -->
    <div class="space-y-3">
      <label class="flex cursor-pointer items-center space-x-2">
        <Checkbox checked={filters.inStockOnly} onCheckedChange={(v) => (filters.inStockOnly = !!v)} />
        <span>In Stock Only</span>
      </label>
      <label class="flex cursor-pointer items-center space-x-2">
        <Checkbox checked={filters.isNew} onCheckedChange={(v) => (filters.isNew = !!v)} />
        <span>New Cards Only</span>
      </label>
      <label class="flex cursor-pointer items-center space-x-2">
        <Checkbox checked={filters.isMisprint} onCheckedChange={(v) => (filters.isMisprint = !!v)} />
        <span class="flex items-center gap-1">
          Misprints Only
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <span {...props} class="inline-flex cursor-default" onclick={(e) => e.stopPropagation()}>
                    <Info class="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p class="max-w-[220px] text-xs">
                  Misprints are cards with accidental printing errors, or cards that don't exist as official paper MTG releases.
                </p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </span>
      </label>
    </div>
  </div>
</div>
