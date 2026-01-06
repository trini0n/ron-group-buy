<script lang="ts">
  import { Label } from '$components/ui/label';
  import { Checkbox } from '$components/ui/checkbox';
  import * as Select from '$components/ui/select';
  import { Button } from '$components/ui/button';
  import { X } from 'lucide-svelte';

  interface Set {
    code: string;
    name: string;
  }

  interface Filters {
    setCode: string;
    colorIdentity: string[];
    cardType: '' | 'Normal' | 'Holo' | 'Foil';
    inStockOnly: boolean;
    isNew: boolean;
  }

  interface Props {
    filters: Filters;
    sets: Set[];
  }

  let { filters = $bindable(), sets }: Props = $props();

  const colors = [
    { value: 'W', label: 'White', class: 'mana-w' },
    { value: 'U', label: 'Blue', class: 'mana-u' },
    { value: 'B', label: 'Black', class: 'mana-b' },
    { value: 'R', label: 'Red', class: 'mana-r' },
    { value: 'G', label: 'Green', class: 'mana-g' }
  ];

  const cardTypes = [
    { value: '', label: 'All Types' },
    { value: 'Normal', label: 'Normal ($1.25)' },
    { value: 'Holo', label: 'Holo ($1.25)' },
    { value: 'Foil', label: 'Foil ($1.50)' }
  ];

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
      inStockOnly: false,
      isNew: false
    };
  }

  const hasActiveFilters = $derived(() => {
    return (
      filters.setCode !== '' ||
      filters.colorIdentity.length > 0 ||
      filters.cardType !== '' ||
      filters.inStockOnly ||
      filters.isNew
    );
  });
</script>

<div class="space-y-6 rounded-lg border bg-card p-4">
  <div class="flex items-center justify-between">
    <h2 class="font-semibold">Filters</h2>
    {#if hasActiveFilters()}
      <Button variant="ghost" size="sm" onclick={clearFilters}>
        <X class="mr-1 h-3 w-3" />
        Clear
      </Button>
    {/if}
  </div>

  <!-- Set Filter -->
  <div class="space-y-2">
    <Label>Set</Label>
    <Select.Root bind:value={filters.setCode}>
      <Select.Trigger>
        <Select.Value placeholder="All Sets" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="">All Sets</Select.Item>
        {#each sets as set}
          <Select.Item value={set.code}>{set.name} ({set.code})</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  <!-- Color Identity -->
  <div class="space-y-2">
    <Label>Color Identity</Label>
    <div class="flex flex-wrap gap-2">
      {#each colors as color}
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all {filters.colorIdentity.includes(color.value) ? 'ring-2 ring-ring ring-offset-2' : ''} {color.class}"
          onclick={() => toggleColor(color.value)}
        >
          {color.value}
        </button>
      {/each}
    </div>
  </div>

  <!-- Card Type -->
  <div class="space-y-2">
    <Label>Card Type</Label>
    <Select.Root bind:value={filters.cardType}>
      <Select.Trigger>
        <Select.Value placeholder="All Types" />
      </Select.Trigger>
      <Select.Content>
        {#each cardTypes as type}
          <Select.Item value={type.value}>{type.label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  <!-- Toggles -->
  <div class="space-y-3">
    <div class="flex items-center space-x-2">
      <Checkbox id="inStock" bind:checked={filters.inStockOnly} />
      <Label for="inStock" class="cursor-pointer">In Stock Only</Label>
    </div>
    <div class="flex items-center space-x-2">
      <Checkbox id="isNew" bind:checked={filters.isNew} />
      <Label for="isNew" class="cursor-pointer">New Cards Only</Label>
    </div>
  </div>
</div>
