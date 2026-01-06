<script lang="ts">
  import { Label } from '$components/ui/label';
  import { Checkbox } from '$components/ui/checkbox';
  import { Button } from '$components/ui/button';
  import * as Select from '$components/ui/select';
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
    cardType: '' | 'Normal' | 'Holo' | 'Foil';
    mtgTypes: string[];
    inStockOnly: boolean;
    isNew: boolean;
  }

  interface Props {
    filters: Filters;
    sets: Set[];
  }

  let { filters = $bindable(), sets }: Props = $props();

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

  const cardTypes = [
    { value: '', label: 'All Types' },
    { value: 'Normal', label: 'Normal ($1.25)' },
    { value: 'Holo', label: 'Holo ($1.25)' },
    { value: 'Foil', label: 'Foil ($1.50)' }
  ];

  const mtgTypes = [
    'Land',
    'Creature',
    'Artifact',
    'Enchantment',
    'Planeswalker',
    'Battle',
    'Instant',
    'Sorcery'
  ];

  function toggleMtgType(type: string) {
    if (filters.mtgTypes.includes(type)) {
      filters.mtgTypes = filters.mtgTypes.filter((t) => t !== type);
    } else {
      filters.mtgTypes = [...filters.mtgTypes, type];
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
      cardType: '',
      mtgTypes: [],
      inStockOnly: false,
      isNew: false
    };
    setSearchValue = '';
  }

  function selectSet(code: string) {
    filters.setCode = code;
    setComboboxOpen = false;
    setSearchValue = '';
  }

  const hasActiveFilters = $derived(
    filters.setCode !== '' ||
      filters.colorIdentity.length > 0 ||
      filters.cardType !== '' ||
      filters.mtgTypes.length > 0 ||
      filters.inStockOnly ||
      filters.isNew
  );

  // Get display labels for selects
  const selectedSetLabel = $derived(
    filters.setCode ? sets.find((s) => s.code === filters.setCode)?.name ?? 'All Sets' : 'All Sets'
  );

  const selectedTypeLabel = $derived(
    cardTypes.find((t) => t.value === filters.cardType)?.label ?? 'All Types'
  );

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
        <Button
          variant="outline"
          class="w-full justify-between"
          role="combobox"
          aria-expanded={setComboboxOpen}
        >
          <span class="truncate">{selectedSetLabel}</span>
          <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </Popover.Trigger>
      <Popover.Content class="w-[300px] p-0" align="start">
        <Command.Root>
          <Command.Input
            placeholder="Search sets..."
            bind:value={setSearchValue}
          />
          <Command.List>
            <Command.Empty>No sets found.</Command.Empty>
            <Command.Group>
              <Command.Item
                value=""
                onSelect={() => selectSet('')}
              >
                <Check
                  class="mr-2 h-4 w-4 {filters.setCode === '' ? 'opacity-100' : 'opacity-0'}"
                />
                All Sets
              </Command.Item>
              {#each filteredSets as set (set.code)}
                <Command.Item
                  value="{set.name} {set.code}"
                  onSelect={() => selectSet(set.code)}
                >
                  <Check
                    class="mr-2 h-4 w-4 {filters.setCode === set.code ? 'opacity-100' : 'opacity-0'}"
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
  </div>

  <!-- MTG Types (Type Line) -->
  <div class="space-y-2">
    <Label>MTG Type</Label>
    <div class="grid grid-cols-2 gap-2">
      {#each mtgTypes as type}
        <div class="flex items-center space-x-2">
          <Checkbox
            id="mtgType-{type}"
            checked={filters.mtgTypes.includes(type)}
            onCheckedChange={() => toggleMtgType(type)}
          />
          <Label for="mtgType-{type}" class="cursor-pointer text-sm">{type}</Label>
        </div>
      {/each}
    </div>
  </div>

  <!-- Card Type (Price Category) -->
  <div class="space-y-2">
    <Label>Price Category</Label>
    <Select.Root
      type="single"
      bind:value={filters.cardType}
    >
      <Select.Trigger class="w-full">
        {selectedTypeLabel}
      </Select.Trigger>
      <Select.Content>
        {#each cardTypes as type}
          <Select.Item value={type.value} label={type.label}>{type.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  <!-- Toggles -->
  <div class="space-y-3">
    <div class="flex items-center space-x-2">
      <Checkbox id="inStock" checked={filters.inStockOnly} onCheckedChange={(v) => filters.inStockOnly = !!v} />
      <Label for="inStock" class="cursor-pointer">In Stock Only</Label>
    </div>
    <div class="flex items-center space-x-2">
      <Checkbox id="isNew" checked={filters.isNew} onCheckedChange={(v) => filters.isNew = !!v} />
      <Label for="isNew" class="cursor-pointer">New Cards Only</Label>
    </div>
  </div>
</div>
