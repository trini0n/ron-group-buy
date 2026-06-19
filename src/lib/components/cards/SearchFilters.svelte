<script lang="ts">
  import { Label } from '$components/ui/label'
  import { Checkbox } from '$components/ui/checkbox'
  import { Button } from '$components/ui/button'
  import * as Popover from '$components/ui/popover'
  import * as Command from '$components/ui/command'
  import * as Accordion from '$components/ui/accordion'
  import ManaIcon from '$lib/components/icons/ManaIcon.svelte'
  import { X, ChevronsUpDown, Check, ChevronDown, Filter, Info } from 'lucide-svelte'
  import { browser } from '$app/environment'
  import * as Tooltip from '$components/ui/tooltip'

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
  }

  interface Props {
    filters: Filters
    sets: Set[]
    onClearAll?: () => void
  }

  let { filters = $bindable(), sets, onClearAll }: Props = $props()

  // Combobox state
  let setComboboxOpen = $state(false)
  let setSearchValue = $state('')

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

  // Foil subtypes — only visible when 'Foil' is checked
  const FOIL_SUBTYPES = [
    { value: 'Foil', label: 'Regular Foil' },
    { value: 'Galaxy Foil', label: 'Galaxy Foil' },
    { value: 'Raised Foil', label: 'Raised Foil' },
    { value: 'Surge Foil', label: 'Surge Foil' }
  ]

  // Non-Foil subtypes — only visible when 'Non-Foil' is checked
  const NON_FOIL_SUBTYPES = [
    { value: 'Normal', label: 'No Holostamp' },
    { value: 'Holo', label: 'Holostamped' }
  ]

  // Whether the Foil subtype panel is relevant
  const foilSelected = $derived(filters.priceCategories.includes('Foil'))
  // Whether all subtypes are selected (used for the 'all' indicator)
  const allFoilSubtypesSelected = $derived(filters.foilSubtypes.length === FOIL_SUBTYPES.length)

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
        filters.foilSubtypes = FOIL_SUBTYPES.map((s) => s.value)
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
    filters.foilSubtypes = FOIL_SUBTYPES.map((s) => s.value)
    filters.nonFoilSubtypes = NON_FOIL_SUBTYPES.map((s) => s.value)
    filters.cardTypes = []
    filters.frameTypes = []
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
            class="relative rounded-full transition-all {filters.colorIdentity.includes(color.value)
              ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              : 'opacity-60 hover:opacity-100'}"
            onclick={() => toggleColor(color.value)}
            title={color.label}
          >
            <ManaIcon color={color.value} size={32} />
          </button>
        {/each}
      </div>
      {#if filters.colorIdentity.length > 0}
        <div class="mt-3 flex overflow-hidden rounded-md border border-border text-sm">
          <button
            type="button"
            class="flex-1 px-3 py-1 transition-colors {filters.colorIdentityStrict
              ? 'bg-foreground text-background font-medium'
              : 'bg-transparent text-muted-foreground hover:text-foreground'}"
            onclick={() => (filters.colorIdentityStrict = true)}
          >
            Only
          </button>
          <button
            type="button"
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

    <!-- Card Types (Type Line) - Multiselect with OR logic -->
    <div class="space-y-2">
      <Label>Card Type</Label>
      <div class="grid grid-cols-2 gap-2">
        {#each cardTypes as type}
          <label class="flex cursor-pointer items-center space-x-2">
            <Checkbox checked={filters.cardTypes.includes(type)} onCheckedChange={() => toggleCardType(type)} />
            <span class="text-sm">{type}</span>
          </label>
        {/each}
      </div>
    </div>

    <!-- Finish (card_type column) - 3 top-level categories + foil subtypes -->
    <div class="space-y-2">
      <Label>Finish</Label>
      <div class="space-y-2">
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
              {#each FOIL_SUBTYPES as sub}
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
    </div>

    <!-- Frame Type Filter -->
    <div class="space-y-2">
      <Label>Frame Type</Label>
      <div class="space-y-2">
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
    </div>

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
                  Misprint cards have accidental printing errors or do not exist as real paper MTG cards
                </p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </span>
      </label>
    </div>
  </div>
</div>
