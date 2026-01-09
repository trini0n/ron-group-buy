<script lang="ts">
  import type { Card } from '$lib/server/types';
  import CardItem from './CardItem.svelte';
  import * as Pagination from '$components/ui/pagination';
  import { Button } from '$components/ui/button';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

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
  }

  let { cards, searchQuery, filters }: Props = $props();

  const CARDS_PER_PAGE = 25;
  let currentPage = $state(1);

  // Filter individual cards first
  const filteredCards = $derived.by(() => {
    return cards.filter((card) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = card.card_name.toLowerCase().includes(query);
        const setMatch = card.set_name?.toLowerCase().includes(query);
        const typeMatch = card.type_line?.toLowerCase().includes(query);
        if (!nameMatch && !setMatch && !typeMatch) return false;
      }

      // Set filter (case-insensitive, multi-select - OR logic)
      if (filters.setCodes.length > 0) {
        const cardSetCode = card.set_code?.toLowerCase() || '';
        if (!filters.setCodes.includes(cardSetCode)) {
          return false;
        }
      }

      // Color identity filter
      if (filters.colorIdentity.length > 0) {
        const cardColors = (card.color_identity?.split(', ') || []).filter(c => c);
        if (filters.colorIdentityStrict) {
          // Strict mode: card must only have colors from the selected set (subset match)
          // e.g., if B,G,R selected, show cards with B, G, R, BG, BR, GR, BGR, or colorless
          const hasDisallowedColor = cardColors.some((c) => !filters.colorIdentity.includes(c));
          if (hasDisallowedColor) return false;
        } else {
          // Non-strict: card has at least one of the selected colors
          const hasMatchingColor = filters.colorIdentity.some((c) => cardColors.includes(c));
          if (!hasMatchingColor) return false;
        }
      }

      // Finish filter (card_type column) - filter OUT unchecked categories
      if (filters.priceCategories.length < 2) {
        // Map filter values to actual card_type values
        const allowedTypes: string[] = [];
        if (filters.priceCategories.includes('Non-Foil')) {
          allowedTypes.push('Normal', 'Holo');
        }
        if (filters.priceCategories.includes('Foil')) {
          allowedTypes.push('Foil');
        }
        if (!allowedTypes.includes(card.card_type)) {
          return false;
        }
      }

      // Card type filter (type line) - OR logic
      if (filters.cardTypes.length > 0) {
        if (!card.type_line) return false;
        // Parse type line, removing supertypes
        const typeLine = card.type_line.toLowerCase();
        // Get the types before any em dash (ignoring subtypes)
        const mainTypes = typeLine.split('—')[0].trim();
        // Split into words and filter out supertypes
        const cardTypeWords = mainTypes.split(/\s+/).filter((t) => !SUPERTYPES.includes(t));
        // Check if any selected type matches (OR logic)
        const hasMatchingType = filters.cardTypes.some((selectedType) =>
          cardTypeWords.includes(selectedType.toLowerCase())
        );
        if (!hasMatchingType) return false;
      }

      // Frame type filter - OR logic (show cards matching ANY selected frame type)
      if (filters.frameTypes.length > 0) {
        const matchesFrameType = filters.frameTypes.some((frameType) => {
          switch (frameType) {
            case 'retro':
              return card.is_retro === true;
            case 'extended':
              return card.is_extended === true;
            case 'borderless':
              return card.is_borderless === true;
            case 'showcase':
              return card.is_showcase === true;
            default:
              return false;
          }
        });
        if (!matchesFrameType) return false;
      }

      // In stock filter
      if (filters.inStockOnly && !card.is_in_stock) {
        return false;
      }

      // New cards filter
      if (filters.isNew && !card.is_new) {
        return false;
      }

      return true;
    });
  });

  // Group filtered cards by set_code + collector_number + language
  // Dedupe by finish type (card_type) and sort: Normal → Holo → Foil
  interface CardGroup {
    primary: Card;
    finishVariants: Card[];
  }

  const FINISH_ORDER: Record<string, number> = {
    'Normal': 0,
    'Holo': 1,
    'Foil': 2,
    'Surge Foil': 3
  };

  const groupedCards = $derived.by(() => {
    const groups = new Map<string, CardGroup>();
    
    for (const card of filteredCards) {
      const groupKey = `${card.set_code?.toLowerCase() || ''}|${card.collector_number || ''}|${card.language?.toLowerCase() || 'en'}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { primary: card, finishVariants: [] });
      }
      
      const group = groups.get(groupKey)!;
      
      // Dedupe by card_type (finish) - only keep one per finish type, prefer in-stock
      const existingFinishIdx = group.finishVariants.findIndex(v => v.card_type === card.card_type);
      if (existingFinishIdx === -1) {
        // No existing card with this finish type, add it
        group.finishVariants.push(card);
      } else if (card.is_in_stock && !group.finishVariants[existingFinishIdx].is_in_stock) {
        // Replace out-of-stock with in-stock version
        group.finishVariants[existingFinishIdx] = card;
      }
    }
    
    // Sort finish variants and set primary
    for (const group of groups.values()) {
      group.finishVariants.sort((a, b) => {
        // Sort by finish order
        const orderA = FINISH_ORDER[a.card_type] ?? 99;
        const orderB = FINISH_ORDER[b.card_type] ?? 99;
        return orderA - orderB;
      });
      
      // Set primary to first in-stock variant, or first overall
      const inStock = group.finishVariants.find(v => v.is_in_stock);
      group.primary = inStock || group.finishVariants[0];
    }
    
    return Array.from(groups.values());
  });

  const totalPages = $derived(Math.ceil(groupedCards.length / CARDS_PER_PAGE));

  // Reset to page 1 when filters change
  $effect(() => {
    // Access filters and searchQuery to track changes
    void filters;
    void searchQuery;
    currentPage = 1;
  });

  const paginatedGroups = $derived.by(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    const end = start + CARDS_PER_PAGE;
    return groupedCards.slice(start, end);
  });

  function goToPage(page: number) {
    currentPage = Math.max(1, Math.min(page, totalPages));
    // Scroll to top of grid
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
