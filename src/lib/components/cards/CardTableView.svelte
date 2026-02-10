<script lang="ts">
  import type { Card } from '$lib/server/types';
  import * as Table from '$components/ui/table';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Checkbox } from '$components/ui/checkbox';
  import { Badge } from '$components/ui/badge';
  import { ChevronUp, ChevronDown, ShoppingCart, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-svelte';
  import { getRonImageUrl, getScryfallImageUrl } from '$lib/utils';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { getCardPrice, formatPrice, getCardUrl, getFinishLabel, getFinishBadgeClasses } from '$lib/utils';
  import { browser } from '$app/environment';
  import { untrack } from 'svelte';

  interface Filters {
    setCodes: string[];
    colorIdentity: string[];
    colorIdentityStrict: boolean;
    priceCategories: string[];
    cardTypes: string[];
    frameTypes: string[];
    inStockOnly: boolean;
    isNew: boolean;
  }

  // Supertypes to ignore when matching card types
  const SUPERTYPES = ['basic', 'legendary', 'snow', 'world', 'ongoing', 'host'];

  interface Props {
    cards: Card[];
    searchQuery: string;
    filters: Filters;
    currentPage?: number;
    onPageChange?: (page: number) => void;
  }

  let { cards, searchQuery, filters, currentPage: propPage = 1, onPageChange }: Props = $props();

  // Sorting state with session storage persistence and default
  type SortKey = 'set_code' | 'collector_number' | 'card_name' | 'mana_cost' | 'type_line' | 'language' | 'card_type';
  
  // Load from session storage or default to card_name ascending
  function loadSortState(): { key: SortKey; dir: 'asc' | 'desc' } {
    if (browser) {
      const saved = sessionStorage.getItem('tableViewSort');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return { key: parsed.key || 'card_name', dir: parsed.dir || 'asc' };
        } catch { /* fall through to default */ }
      }
    }
    return { key: 'card_name', dir: 'asc' };
  }
  
  const initialSort = loadSortState();
  let sortKey = $state<SortKey>(initialSort.key);
  let sortDirection = $state<'asc' | 'desc'>(initialSort.dir);
  
  // Persist sort state to session storage
  $effect(() => {
    if (browser) {
      sessionStorage.setItem('tableViewSort', JSON.stringify({ key: sortKey, dir: sortDirection }));
    }
  });

  // Selection state
  let selectedSerials = $state<Set<string>>(new Set());
  let bulkQuantity = $state(1);
  
  // Per-row quantity state
  let rowQuantities = $state<Map<string, number>>(new Map());
  
  // Get quantity for a row (default 1)
  function getRowQuantity(serial: string): number {
    return rowQuantities.get(serial) ?? 1;
  }
  
  // Set quantity for a row
  function setRowQuantity(serial: string, qty: number) {
    const newMap = new Map(rowQuantities);
    newMap.set(serial, Math.max(1, Math.min(99, qty)));
    rowQuantities = newMap;
  }

  // Hover state for card image popup
  let hoveredCard = $state<Card | null>(null);
  let hoverPosition = $state({ x: 0, y: 0 });

  // Pagination
  const CARDS_PER_PAGE = 50;

  // Get frame type label
  function getFrameType(card: Card): string {
    const frames: string[] = [];
    if (card.is_retro) frames.push('Retro');
    if (card.is_extended) frames.push('Extended');
    if (card.is_borderless) frames.push('Borderless');
    if (card.is_showcase) frames.push('Showcase');
    return frames.join(', ') || '-';
  }

  // Get main card type from type line
  function getMainCardType(typeLine: string | null): string {
    if (!typeLine) return '-';
    const parts = typeLine.split('—')
    const mainTypes = parts[0]?.trim() || '-'
    const words = mainTypes.split(/\s+/).filter((t) => !SUPERTYPES.includes(t.toLowerCase()));
    return words.join(' ') || '-';
  }

  // Filter cards (pure function)
  function filterCards(allCards: Card[], query: string, f: Filters): Card[] {
    return allCards.filter((card) => {
      // Search query filter - matches card name and flavor name only
      if (query) {
        const q = query.toLowerCase();
        const nameMatch = card.card_name.toLowerCase().includes(q);
        const flavorMatch = card.flavor_name?.toLowerCase().includes(q);
        if (!nameMatch && !flavorMatch) return false;
      }

      // Set filter (case-insensitive, multi-select - OR logic)
      if (f.setCodes.length > 0) {
        const cardSetCode = card.set_code?.toLowerCase() || '';
        if (!f.setCodes.includes(cardSetCode)) {
          return false;
        }
      }

      // Color identity filter
      if (f.colorIdentity.length > 0) {
        const cardColors = (card.color_identity?.split(', ') || []).filter((c: string) => c);
        if (f.colorIdentityStrict) {
          const hasDisallowedColor = cardColors.some((c: string) => !f.colorIdentity.includes(c));
          if (hasDisallowedColor) return false;
        } else {
          const hasMatchingColor = f.colorIdentity.some((c) => cardColors.includes(c));
          if (!hasMatchingColor) return false;
        }
      }

      // Finish filter (card_type column)
      if (f.priceCategories.length < 2) {
        const allowedTypes: string[] = [];
        if (f.priceCategories.includes('Non-Foil')) {
          allowedTypes.push('Normal', 'Holo');
        }
        if (f.priceCategories.includes('Foil')) {
          allowedTypes.push('Foil');
        }
        if (!allowedTypes.includes(card.card_type)) {
          return false;
        }
      }

      // Card type filter (type line)
      if (f.cardTypes.length > 0) {
        if (!card.type_line) return false;
        const typeLine = card.type_line.toLowerCase();
        const parts = typeLine.split('—')
        const mainTypes =  parts[0]?.trim() || ''
        const cardTypeWords = mainTypes.split(/\s+/).filter((t: string) => !SUPERTYPES.includes(t));
        const hasMatchingType = f.cardTypes.some((selectedType) =>
          cardTypeWords.includes(selectedType.toLowerCase())
        );
        if (!hasMatchingType) return false;
      }

      // Frame type filter
      if (f.frameTypes.length > 0) {
        const matchesFrameType = f.frameTypes.some((frameType) => {
          switch (frameType) {
            case 'retro': return card.is_retro === true;
            case 'extended': return card.is_extended === true;
            case 'borderless': return card.is_borderless === true;
            case 'showcase': return card.is_showcase === true;
            default: return false;
          }
        });
        if (!matchesFrameType) return false;
      }

      // In stock filter
      if (f.inStockOnly && !card.is_in_stock) return false;

      // New cards filter
      if (f.isNew && !card.is_new) return false;

      return true;
    });
  }

  // Sort cards (pure function)
  function sortCards(cardsToSort: Card[], key: SortKey, direction: 'asc' | 'desc'): Card[] {
    return [...cardsToSort].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (key) {
        case 'set_code':
          aVal = a.set_code ?? '';
          bVal = b.set_code ?? '';
          break;
        case 'collector_number':
          // Try to parse as number for proper numeric sort
          aVal = parseInt(a.collector_number ?? '0') || (a.collector_number ?? '');
          bVal = parseInt(b.collector_number ?? '0') || (b.collector_number ?? '');
          break;
        case 'card_name':
          aVal = a.card_name;
          bVal = b.card_name;
          break;
        case 'mana_cost':
          aVal = a.mana_cost ?? '';
          bVal = b.mana_cost ?? '';
          break;
        case 'type_line':
          aVal = a.type_line ?? '';
          bVal = b.type_line ?? '';
          break;
        case 'language':
          aVal = a.language ?? 'en';
          bVal = b.language ?? 'en';
          break;
        case 'card_type':
          aVal = a.card_type;
          bVal = b.card_type;
          break;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const comparison = String(aVal).localeCompare(String(bVal));
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  // State for deferred sorted cards
  let sortedCards = $state<Card[]>([]);
  // Store the frame ID so we can cancel pending updates
  let pendingFilterFrameId: number | null = null;
  let initialLoadDone = false;

  // Deferred filter and sort - uses requestAnimationFrame to let UI paint first
  $effect(() => {
    // Read dependencies to establish tracking
    const currentCards = cards;
    const currentQuery = searchQuery;
    const currentKey = sortKey;
    const currentDir = sortDirection;
    // Create a snapshot of filters to avoid tracking nested changes
    const currentFilters = {
      setCodes: [...filters.setCodes],
      colorIdentity: [...filters.colorIdentity],
      colorIdentityStrict: filters.colorIdentityStrict,
      priceCategories: [...filters.priceCategories],
      cardTypes: [...filters.cardTypes],
      frameTypes: [...filters.frameTypes],
      inStockOnly: filters.inStockOnly,
      isNew: filters.isNew
    };
    
    // Cancel any pending frame to prevent stacking updates
    if (pendingFilterFrameId !== null) {
      cancelAnimationFrame(pendingFilterFrameId);
    }
    
    // For initial load with cards, do it synchronously to avoid flash
    if (!initialLoadDone && currentCards.length > 0) {
      initialLoadDone = true;
      untrack(() => {
        const filtered = filterCards(currentCards, currentQuery, currentFilters);
        sortedCards = sortCards(filtered, currentKey, currentDir);
      });
      return;
    }
    
    // Use requestAnimationFrame to defer filtering after browser paint
    pendingFilterFrameId = requestAnimationFrame(() => {
      pendingFilterFrameId = null;
      // Use untrack to avoid reading state during update
      untrack(() => {
        const filtered = filterCards(currentCards, currentQuery, currentFilters);
        sortedCards = sortCards(filtered, currentKey, currentDir);
      });
    });
  });

  // Pagination
  const totalPages = $derived(Math.ceil(sortedCards.length / CARDS_PER_PAGE));
  
  const paginatedCards = $derived.by(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    const end = start + CARDS_PER_PAGE;
    return sortedCards.slice(start, end);
  });

  // Internal page state synced with prop
  let internalPage = $state(1);
  
  $effect(() => {
    internalPage = propPage;
  });
  
  // Use internal page bounded by total pages
  const currentPage = $derived(Math.min(internalPage, Math.max(1, totalPages)));

  // Reset selection when filters change (but page is controlled externally)
  // Use untrack to prevent cascading reactivity when clearing selection
  $effect(() => {
    void filters;
    void searchQuery;
    untrack(() => {
      selectedSerials = new Set();
    });
  });

  // Toggle sort
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDirection = 'asc';
    }
  }

  // Selection helpers
  function toggleSelect(serial: string) {
    const newSet = new Set(selectedSerials);
    if (newSet.has(serial)) {
      newSet.delete(serial);
    } else {
      newSet.add(serial);
    }
    selectedSerials = newSet;
  }

  function toggleSelectAll() {
    if (selectedSerials.size === paginatedCards.length) {
      selectedSerials = new Set();
    } else {
      selectedSerials = new Set(paginatedCards.map((c) => c.serial));
    }
  }

  const allSelected = $derived(paginatedCards.length > 0 && selectedSerials.size === paginatedCards.length);
  const someSelected = $derived(selectedSerials.size > 0 && selectedSerials.size < paginatedCards.length);

  // Add selected cards to cart
  function addSelectedToCart() {
    const selectedCards = paginatedCards.filter((c) => selectedSerials.has(c.serial) && c.is_in_stock);
    for (const card of selectedCards) {
      const qty = getRowQuantity(card.serial);
      cartStore.addItem(card, qty);
    }
    selectedSerials = new Set();
    rowQuantities = new Map();
  }

  // Handle mouse move for card image popup
  function handleRowMouseMove(e: MouseEvent, card: Card) {
    hoveredCard = card;
    hoverPosition = { x: e.clientX, y: e.clientY };
  }

  function handleRowMouseLeave() {
    hoveredCard = null;
  }

  // Get image URL for hover popup
  function getCardImageUrl(card: Card): string {
    const ronUrl = getRonImageUrl(card.ron_image_url);
    if (ronUrl) return ronUrl;
    return card.scryfall_id 
      ? getScryfallImageUrl(card.scryfall_id, 'normal') 
      : '/images/card-placeholder.png';
  }

  function goToPage(page: number) {
    const newPage = Math.max(1, Math.min(page, totalPages));
    internalPage = newPage;
    onPageChange?.(newPage);
  }

  // Sort header component
  function SortIcon(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? ChevronUp : ChevronDown;
  }
</script>

{#if sortedCards.length === 0}
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <p class="text-xl font-medium">No cards found</p>
    <p class="mt-2 text-muted-foreground">Try adjusting your search or filters</p>
  </div>
{:else}
  <!-- Bulk actions bar -->
  {#if selectedSerials.size > 0}
    <div class="mb-4 flex items-center gap-4 rounded-lg border bg-muted/50 p-3">
      <span class="text-sm font-medium">{selectedSerials.size} card(s) selected</span>
      <Button size="sm" onclick={addSelectedToCart}>
        <ShoppingCart class="mr-2 h-4 w-4" />
        Add to Cart
      </Button>
      <Button size="sm" variant="ghost" onclick={() => selectedSerials = new Set()}>
        Clear Selection
      </Button>
    </div>
  {/if}

  <!-- Results count -->
  <div class="mb-4 flex items-center justify-between text-sm text-muted-foreground">
    <span>
      Showing {(currentPage - 1) * CARDS_PER_PAGE + 1}–{Math.min(currentPage * CARDS_PER_PAGE, sortedCards.length)} of {sortedCards.length} cards
    </span>
    {#if totalPages > 1}
      <span>Page {currentPage} of {totalPages}</span>
    {/if}
  </div>

  <!-- Data table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-10">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={toggleSelectAll}
            />
          </Table.Head>
          <Table.Head class="w-16">Qty</Table.Head>
          <Table.Head class="w-20 cursor-pointer select-none" onclick={() => toggleSort('set_code')}>
            <div class="flex items-center gap-1">
              Set
              {#if sortKey === 'set_code'}
                {#if sortDirection === 'asc'}
                  <ChevronUp class="h-4 w-4" />
                {:else}
                  <ChevronDown class="h-4 w-4" />
                {/if}
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="w-16 cursor-pointer select-none" onclick={() => toggleSort('collector_number')}>
            <div class="flex items-center gap-1">
              №
              {#if sortKey === 'collector_number'}
                {#if sortDirection === 'asc'}
                  <ChevronUp class="h-4 w-4" />
                {:else}
                  <ChevronDown class="h-4 w-4" />
                {/if}
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="cursor-pointer select-none" onclick={() => toggleSort('card_name')}>
            <div class="flex items-center gap-1">
              Card Name
              {#if sortKey === 'card_name'}
                {#if sortDirection === 'asc'}
                  <ChevronUp class="h-4 w-4" />
                {:else}
                  <ChevronDown class="h-4 w-4" />
                {/if}
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="cursor-pointer select-none" onclick={() => toggleSort('type_line')}>
            <div class="flex items-center gap-1">
              Type
              {#if sortKey === 'type_line'}
                {#if sortDirection === 'asc'}
                  <ChevronUp class="h-4 w-4" />
                {:else}
                  <ChevronDown class="h-4 w-4" />
                {/if}
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="w-12 cursor-pointer select-none" onclick={() => toggleSort('language')}>
            <div class="flex items-center gap-1">
              LA
              {#if sortKey === 'language'}
                {#if sortDirection === 'asc'}
                  <ChevronUp class="h-4 w-4" />
                {:else}
                  <ChevronDown class="h-4 w-4" />
                {/if}
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="w-24">Frame</Table.Head>
          <Table.Head class="w-20 cursor-pointer select-none" onclick={() => toggleSort('card_type')}>
            <div class="flex items-center gap-1">
              Finish
              {#if sortKey === 'card_type'}
                {#if sortDirection === 'asc'}
                  <ChevronUp class="h-4 w-4" />
                {:else}
                  <ChevronDown class="h-4 w-4" />
                {/if}
              {/if}
            </div>
          </Table.Head>
          <Table.Head class="w-20">Price</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each paginatedCards as card (card.serial)}
          {@const isSelected = selectedSerials.has(card.serial)}
          {@const price = getCardPrice(card.card_type)}
          {@const rowQty = getRowQuantity(card.serial)}
          <Table.Row class={isSelected ? 'bg-muted/50' : ''}>
            <Table.Cell>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelect(card.serial)}
                disabled={!card.is_in_stock}
              />
            </Table.Cell>
            <Table.Cell>
              <div class="flex items-center gap-2">
                <div class="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6"
                    onclick={() => setRowQuantity(card.serial, rowQty - 1)}
                    disabled={!card.is_in_stock || rowQty <= 1}
                  >
                    <Minus class="h-3 w-3" />
                  </Button>
                  <span class="w-6 text-center text-sm">{rowQty}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6"
                    onclick={() => setRowQuantity(card.serial, rowQty + 1)}
                    disabled={!card.is_in_stock || rowQty >= 99}
                  >
                    <Plus class="h-3 w-3" />
                  </Button>
                </div>
                {#if cartStore.isInCart(card.id)}
                  <div title="In cart">
                    <ShoppingCart class="h-3.5 w-3.5 text-green-600" fill="currentColor" />
                  </div>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell 
              class="font-mono text-xs uppercase"
              onmousemove={(e) => handleRowMouseMove(e, card)}
              onmouseleave={handleRowMouseLeave}
            >
              {card.set_code ?? '-'}
            </Table.Cell>
            <Table.Cell 
              class="font-mono text-xs"
              onmousemove={(e) => handleRowMouseMove(e, card)}
              onmouseleave={handleRowMouseLeave}
            >
              {card.collector_number ?? '-'}
            </Table.Cell>
            <Table.Cell
              onmousemove={(e) => handleRowMouseMove(e, card)}
              onmouseleave={handleRowMouseLeave}
            >
              <a href={getCardUrl(card)} class="font-medium hover:underline">
                {card.card_name}
              </a>
              {#if !card.is_in_stock}
                <Badge variant="destructive" class="ml-2 text-xs">OOS</Badge>
              {/if}
              {#if card.is_new}
                <Badge class="ml-2 bg-green-600 text-xs">New</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell 
              class="text-sm"
              onmousemove={(e) => handleRowMouseMove(e, card)}
              onmouseleave={handleRowMouseLeave}
            >
              {getMainCardType(card.type_line)}
            </Table.Cell>
            <Table.Cell 
              class="text-center font-mono text-xs uppercase"
              onmousemove={(e) => handleRowMouseMove(e, card)}
              onmouseleave={handleRowMouseLeave}
            >
              {(card.language ?? 'en').toUpperCase()}
            </Table.Cell>
            <Table.Cell 
              class="text-xs"
              onmousemove={(e) => handleRowMouseMove(e, card)}
              onmouseleave={handleRowMouseLeave}
            >
              {getFrameType(card)}
            </Table.Cell>
            <Table.Cell
              onmousemove={(e) => handleRowMouseMove(e, card)}
              onmouseleave={handleRowMouseLeave}
            >
              {@const finish = getFinishLabel(card)}
              <Badge class="text-xs {getFinishBadgeClasses(finish)}">{finish}</Badge>
            </Table.Cell>
            <Table.Cell 
              class="font-medium"
              onmousemove={(e) => handleRowMouseMove(e, card)}
              onmouseleave={handleRowMouseLeave}
            >
              {formatPrice(price)}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-6 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === 1}
        onclick={() => goToPage(currentPage - 1)}
      >
        <ChevronLeft class="h-4 w-4" />
      </Button>

      <div class="flex items-center gap-1">
        {#if totalPages <= 7}
          {#each Array(totalPages) as _, i}
            <Button
              variant={currentPage === i + 1 ? 'default' : 'outline'}
              size="icon"
              onclick={() => goToPage(i + 1)}
            >
              {i + 1}
            </Button>
          {/each}
        {:else}
          <Button
            variant={currentPage === 1 ? 'default' : 'outline'}
            size="icon"
            onclick={() => goToPage(1)}
          >
            1
          </Button>

          {#if currentPage > 3}
            <span class="px-2 text-muted-foreground">...</span>
          {/if}

          {#each Array(5) as _, i}
            {@const page = currentPage - 2 + i}
            {#if page > 1 && page < totalPages}
              <Button
                variant={currentPage === page ? 'default' : 'outline'}
                size="icon"
                onclick={() => goToPage(page)}
              >
                {page}
              </Button>
            {/if}
          {/each}

          {#if currentPage < totalPages - 2}
            <span class="px-2 text-muted-foreground">...</span>
          {/if}

          <Button
            variant={currentPage === totalPages ? 'default' : 'outline'}
            size="icon"
            onclick={() => goToPage(totalPages)}
          >
            {totalPages}
          </Button>
        {/if}
      </div>

      <Button
        variant="outline"
        size="icon"
        disabled={currentPage === totalPages}
        onclick={() => goToPage(currentPage + 1)}
      >
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>
  {/if}
{/if}

<!-- Card image popup on hover -->
{#if hoveredCard}
  <div
    class="pointer-events-none fixed z-50 rounded-lg border bg-background shadow-xl"
    style="left: {hoverPosition.x + 20}px; top: {hoverPosition.y - 150}px;"
  >
    <img
      src={getCardImageUrl(hoveredCard)}
      alt={hoveredCard.card_name}
      class="h-[300px] w-auto rounded-lg object-contain"
      referrerpolicy="no-referrer"
    />
  </div>
{/if}
