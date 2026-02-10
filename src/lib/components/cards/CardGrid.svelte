<script lang="ts">
  import type { Card } from '$lib/server/types';
  import CardItem from './CardItem.svelte';
  import * as Pagination from '$components/ui/pagination';
  import { Button } from '$components/ui/button';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';
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

  const CARDS_PER_PAGE = 25;
  let internalPage = $state(1);
  
  // Card groups stored as state for deferred updates
  interface CardGroup {
    primary: Card;
    finishVariants: Card[];
  }
  
  let groupedCards = $state<CardGroup[]>([]);
  
  // Sync internal page with prop when it changes
  $effect(() => {
    internalPage = propPage;
  });

  const FINISH_ORDER: Record<string, number> = {
    'Normal': 0,
    'Holo': 1,
    'Foil': 2,
    'Surge Foil': 3
  };

  // Filter function - pure, no side effects
  function filterAndGroupCards(allCards: Card[], query: string, f: Filters): CardGroup[] {
    // Filter cards
    const filtered = allCards.filter((card) => {
      // Search query filter - matches card name and flavor name only
      if (query) {
        const q = query.toLowerCase();
        const nameMatch = card.card_name.toLowerCase().includes(q);
        const flavorMatch = card.flavor_name?.toLowerCase().includes(q);
        if (!nameMatch && !flavorMatch) return false;
      }

      // Set filter
      if (f.setCodes.length > 0) {
        const cardSetCode = card.set_code?.toLowerCase() || '';
        if (!f.setCodes.includes(cardSetCode)) return false;
      }

      // Color identity filter
      if (f.colorIdentity.length > 0) {
        const cardColors = (card.color_identity?.split(', ') || []).filter(c => c);
        if (f.colorIdentityStrict) {
          const hasDisallowedColor = cardColors.some((c) => !f.colorIdentity.includes(c));
          if (hasDisallowedColor) return false;
        } else {
          const hasMatchingColor = f.colorIdentity.some((c) => cardColors.includes(c));
          if (!hasMatchingColor) return false;
        }
      }

      // Finish filter
      if (f.priceCategories.length < 2) {
        const allowedTypes: string[] = [];
        if (f.priceCategories.includes('Non-Foil')) allowedTypes.push('Normal', 'Holo');
        if (f.priceCategories.includes('Foil')) allowedTypes.push('Foil');
        if (!allowedTypes.includes(card.card_type)) return false;
      }

      // Card type filter
      if (f.cardTypes.length > 0) {
        if (!card.type_line) return false;
        const typeLine = card.type_line.toLowerCase();
        const parts = typeLine.split('—')
        const mainTypes = parts[0]?.trim() || ''
        const cardTypeWords = mainTypes.split(/\s+/).filter((t) => !SUPERTYPES.includes(t));
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

    // Group by set_code + collector_number + language
    const groups = new Map<string, CardGroup>();
    
    for (const card of filtered) {
      const groupKey = `${card.set_code?.toLowerCase() || ''}|${card.collector_number || ''}|${card.language?.toLowerCase() || 'en'}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { primary: card, finishVariants: [] });
      }
      
      const group = groups.get(groupKey)!;
      const existingFinishIdx = group.finishVariants.findIndex(v => v.card_type === card.card_type);
      if (existingFinishIdx === -1) {
        group.finishVariants.push(card);
      } else {
        const existing = group.finishVariants[existingFinishIdx]
        if (existing && card.is_in_stock && !existing.is_in_stock) {
          group.finishVariants[existingFinishIdx] = card;
        }
      }
    }
    
    // Sort finish variants and set primary
    for (const group of groups.values()) {
      group.finishVariants.sort((a, b) => {
        const orderA = FINISH_ORDER[a.card_type] ?? 99;
        const orderB = FINISH_ORDER[b.card_type] ?? 99;
        return orderA - orderB;
      });
      
      const inStock = group.finishVariants.find(v => v.is_in_stock);
      group.primary = inStock || group.finishVariants[0]!;
    }
    
    // Sort: new cards first, then alphabetically
    return Array.from(groups.values()).sort((a, b) => {
      const aIsNew = a.primary.is_new ? 1 : 0;
      const bIsNew = b.primary.is_new ? 1 : 0;
      if (bIsNew !== aIsNew) return bIsNew - aIsNew;
      return a.primary.card_name.localeCompare(b.primary.card_name);
    });
  }


  // Deferred filter update - uses requestAnimationFrame to let UI paint first
  // Store the frame ID so we can cancel pending updates
  let pendingFrameId: number | null = null;
  let initialLoadDone = false;
  
  $effect(() => {
    // Read dependencies to establish tracking
    const currentCards = cards;
    const currentQuery = searchQuery;
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
    if (pendingFrameId !== null) {
      cancelAnimationFrame(pendingFrameId);
    }
    
    // For initial load with cards, do it synchronously to avoid flash
    if (!initialLoadDone && currentCards.length > 0) {
      initialLoadDone = true;
      untrack(() => {
        groupedCards = filterAndGroupCards(currentCards, currentQuery, currentFilters);
      });
      return;
    }
    
    // Use requestAnimationFrame to defer filtering after browser paint
    pendingFrameId = requestAnimationFrame(() => {
      pendingFrameId = null;
      // Use untrack to avoid reading state during update
      untrack(() => {
        groupedCards = filterAndGroupCards(currentCards, currentQuery, currentFilters);
      });
    });
  });

  const totalPages = $derived(Math.ceil(groupedCards.length / CARDS_PER_PAGE));

  // Use internal page bounded by total pages
  const currentPage = $derived(Math.min(internalPage, Math.max(1, totalPages)));

  const paginatedGroups = $derived.by(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    const end = start + CARDS_PER_PAGE;
    return groupedCards.slice(start, end);
  });

  function goToPage(page: number) {
    const newPage = Math.max(1, Math.min(page, totalPages));
    internalPage = newPage;
    onPageChange?.(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

{#if groupedCards.length === 0}
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <p class="text-xl font-medium">No cards found</p>
    <p class="mt-2 text-muted-foreground">Try adjusting your search or filters</p>
  </div>
{:else}
  <!-- Results count and page info -->
  <div class="mb-4 flex items-center justify-between text-sm text-muted-foreground">
    <span>
      Showing {(currentPage - 1) * CARDS_PER_PAGE + 1}–{Math.min(currentPage * CARDS_PER_PAGE, groupedCards.length)} of {groupedCards.length} cards
    </span>
    {#if totalPages > 1}
      <span>Page {currentPage} of {totalPages}</span>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    {#each paginatedGroups as group (group.primary.serial)}
      <CardItem card={group.primary} finishVariants={group.finishVariants} />
    {/each}
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-8 flex items-center justify-center gap-2">
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
          <!-- First page -->
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

          <!-- Pages around current -->
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

          <!-- Last page -->
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
