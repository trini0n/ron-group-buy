<script lang="ts">
  import { Label } from '$components/ui/label';
  import { Checkbox } from '$components/ui/checkbox';
  import { Button } from '$components/ui/button';
  import * as Popover from '$components/ui/popover';
  import * as Command from '$components/ui/command';
  import ManaIcon from '$lib/components/icons/ManaIcon.svelte';
  import { X, ChevronsUpDown, Check } from 'lucide-svelte';

  interface Set {
    code: string;
    name: string;
  }

  interface Filters {
    setCode: string;
    colorIdentity: string[];
    colorIdentityStrict: boolean;
    priceCategories: string[];
    cardTypes: string[];
    frameTypes: string[];
    inStockOnly: boolean;
    isNew: boolean;
  }

  interface Props {
    filters: Filters;
    sets: Set[];
    onClearAll?: () => void;
  }

  let { filters = $bindable(), sets, onClearAll }: Props = $props();

  // Combobox state
  let setComboboxOpen = $state(false);
  let setSearchValue = $state('');

  const colors: Array<{ value: 'W' | 'U' | 'B' | 'R' | 'G'; label: string }> = [
    { value: 'W', label: 'White' },
    { value: 'U', label: 'Blue' },
    { value: 'B', label: 'Black' },
    { value: 'R', label: 'Red' },
    { value: 'G', label: 'Green' }
  ];

  const priceCategories = [
    { value: 'Non-Foil', label: 'Non-Foil' },
    { value: 'Foil', label: 'Foil' }
  ];

  const cardTypes = [
    'Land',
    'Creature',
    'Artifact',
    'Enchantment',
    'Planeswalker',
    'Battle',
    'Instant',
    'Sorcery'
  ];

  const frameTypes = [
    { value: 'retro', label: 'Retro' },
    { value: 'extended', label: 'Extended Art' },
    { value: 'borderless', label: 'Full Art (Borderless)' },
    { value: 'showcase', label: 'Showcase' }
  ];

  function toggleCardType(type: string) {
    if (filters.cardTypes.includes(type)) {
      filters.cardTypes = filters.cardTypes.filter((t) => t !== type);
    } else {
      filters.cardTypes = [...filters.cardTypes, type];
    }
  }

  function togglePriceCategory(category: string) {
    if (filters.priceCategories.includes(category)) {
      filters.priceCategories = filters.priceCategories.filter((c) => c !== category);
    } else {
      filters.priceCategories = [...filters.priceCategories, category];
    }
  }

  function toggleFrameType(frameType: string) {
    if (filters.frameTypes.includes(frameType)) {
      filters.frameTypes = filters.frameTypes.filter((f) => f !== frameType);
    } else {
      filters.frameTypes = [...filters.frameTypes, frameType];
    }
  }

  function toggleColor(color: string) {
    if (filters.colorIdentity.includes(color)) {
      filters.colorIdentity = filters.colorIdentity.filter((c) => c !== color);
    } else {
      filters.colorIdentity = [...filters.colorIdentity, color];
    }
  }

  function clearFilters() {
    filters = {
      setCode: '',
      colorIdentity: [],
      colorIdentityStrict: false,
      priceCategories: ['Non-Foil', 'Foil'],
      cardTypes: [],
      frameTypes: [],
      inStockOnly: false,
      isNew: false
    };
    setSearchValue = '';
    onClearAll?.();
  }

  function selectSet(code: string) {
    filters.setCode = code;
    setComboboxOpen = false;
    setSearchValue = '';
  }

  const hasActiveFilters = $derived(
    filters.setCode !== '' ||
      filters.colorIdentity.length > 0 ||
      filters.priceCategories.length < 2 ||
      filters.cardTypes.length > 0 ||
      filters.frameTypes.length > 0 ||
      filters.inStockOnly ||
      filters.isNew
  );

  // Get display labels for selects
  const selectedSetLabel = $derived.by(() => {
    if (!filters.setCode) return 'All Sets';
    const filterCode = filters.setCode.toLowerCase();
    const set = sets.find((s) => s.code.toLowerCase() === filterCode);
    return set ? `${set.name} (${set.code.toUpperCase()})` : 'All Sets';
  });

  // Filter sets based on search
  const filteredSets = $derived.by(() => {
    if (!setSearchValue) return sets;
    const query = setSearchValue.toLowerCase();
    return sets.filter(
      (set) =>
        set.name.toLowerCase().includes(query) || set.code.toLowerCase().includes(query)
    );
  });
</script>

<div class="space-y-6 rounded-lg border bg-card p-4">
  <div class="flex items-center justify-between">
    <h2 class="font-semibold">Filters</h2>
    {#if hasActiveFilters}
      <Button variant="ghost" size="sm" onclick={clearFilters}>
        <X class="mr-1 h-3 w-3" />
        Clear
      </Button>
    {/if}
  </div>

  <!-- Set Filter - Combobox -->
  <div class="space-y-2">
    <Label>Set</Label>
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
          <Command.Input
            placeholder="Search sets..."
            bind:value={setSearchValue}
          />
          <Command.List>
            <Command.Empty>No sets found.</Command.Empty>
            <Command.Group>
              <Command.Item
                value="all-sets"
                onSelect={() => selectSet('')}
              >
                <Check
                  class="mr-2 h-4 w-4 {filters.setCode === '' ? 'opacity-100' : 'opacity-0'}"
                />
                All Sets
              </Command.Item>
              {#each filteredSets as set (set.code)}
                <Command.Item
                  value={set.code}
                  onSelect={() => selectSet(set.code)}
                >
                  <Check
                    class="mr-2 h-4 w-4 {filters.setCode.toLowerCase() === set.code.toLowerCase() ? 'opacity-100' : 'opacity-0'}"
                  />
                  <span class="truncate">{set.name}</span>
                  <span class="ml-2 text-xs text-muted-foreground">({set.code})</span>
                </Command.Item>
              {/each}
            </Command.Group>
          </Command.List>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  </div>

  <!-- Color Identity - MTG Mana Icons -->
  <div class="space-y-2">
    <Label>Color Identity</Label>
    <div class="flex flex-wrap gap-2">
      {#each colors as color}
        <button
          type="button"
          class="relative flex items-center justify-center rounded-full transition-all hover:scale-110 {filters.colorIdentity.includes(color.value)
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
      <label class="flex cursor-pointer items-center space-x-2 pt-1">
        <Checkbox
          checked={filters.colorIdentityStrict}
          onCheckedChange={(v) => filters.colorIdentityStrict = !!v}
        />
        <span class="text-sm">Strict (exact match)</span>
      </label>
    {/if}
  </div>

  <!-- Card Types (Type Line) - Multiselect with OR logic -->
  <div class="space-y-2">
    <Label>Card Type</Label>
    <div class="grid grid-cols-2 gap-2">
      {#each cardTypes as type}
        <label class="flex cursor-pointer items-center space-x-2">
          <Checkbox
            checked={filters.cardTypes.includes(type)}
            onCheckedChange={() => toggleCardType(type)}
          />
          <span class="text-sm">{type}</span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Finish (card_type column) - Multiselect, all checked by default -->
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
      <Checkbox
        checked={filters.inStockOnly}
        onCheckedChange={(v) => filters.inStockOnly = !!v}
      />
      <span>In Stock Only</span>
    </label>
    <label class="flex cursor-pointer items-center space-x-2">
      <Checkbox
        checked={filters.isNew}
        onCheckedChange={(v) => filters.isNew = !!v}
      />
      <span>New Cards Only</span>
    </label>
  </div>
</div>
