<script lang="ts">
  import type { Card } from '$lib/server/types';
  import CardItem from './CardItem.svelte';
  import * as Pagination from '$components/ui/pagination';
  import { Button } from '$components/ui/button';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  interface Filters {
    setCode: string;
    colorIdentity: string[];
    cardType: '' | 'Normal' | 'Holo' | 'Foil';
    mtgTypes: string[];
    inStockOnly: boolean;
    isNew: boolean;
  }

  // Supertypes to ignore when matching MTG types
  const SUPERTYPES = ['basic', 'legendary', 'snow', 'world', 'ongoing', 'host'];

  interface Props {
    cards: Card[];
    searchQuery: string;
    filters: Filters;
  }

  let { cards, searchQuery, filters }: Props = $props();

  const CARDS_PER_PAGE = 25;
  let currentPage = $state(1);

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

      // Set filter
      if (filters.setCode && card.set_code !== filters.setCode) {
        return false;
      }

      // Color identity filter
      if (filters.colorIdentity.length > 0) {
        const cardColors = card.color_identity?.split(', ') || [];
        const hasMatchingColor = filters.colorIdentity.some((c) => cardColors.includes(c));
        if (!hasMatchingColor) return false;
      }

      // Card type (price category) filter
      if (filters.cardType && card.card_type !== filters.cardType) {
        return false;
      }

      // MTG type filter (type line)
      if (filters.mtgTypes.length > 0) {
        if (!card.type_line) return false;
        // Parse type line, removing supertypes
        const typeLine = card.type_line.toLowerCase();
        // Get the types before any em dash (ignoring subtypes)
        const mainTypes = typeLine.split('—')[0].trim();
        // Split into words and filter out supertypes
        const cardTypes = mainTypes.split(/\s+/).filter((t) => !SUPERTYPES.includes(t));
        // Check if any selected type matches
        const hasMatchingType = filters.mtgTypes.some((selectedType) =>
          cardTypes.includes(selectedType.toLowerCase())
        );
        if (!hasMatchingType) return false;
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

  const totalPages = $derived(Math.ceil(filteredCards.length / CARDS_PER_PAGE));

  // Reset to page 1 when filters change
  $effect(() => {
    // Access filters and searchQuery to track changes
    void filters;
    void searchQuery;
    currentPage = 1;
  });

  const paginatedCards = $derived.by(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    const end = start + CARDS_PER_PAGE;
    return filteredCards.slice(start, end);
  });

  function goToPage(page: number) {
    currentPage = Math.max(1, Math.min(page, totalPages));
    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

{#if filteredCards.length === 0}
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <p class="text-xl font-medium">No cards found</p>
    <p class="mt-2 text-muted-foreground">Try adjusting your search or filters</p>
  </div>
{:else}
  <!-- Results count and page info -->
  <div class="mb-4 flex items-center justify-between text-sm text-muted-foreground">
    <span>
      Showing {(currentPage - 1) * CARDS_PER_PAGE + 1}–{Math.min(currentPage * CARDS_PER_PAGE, filteredCards.length)} of {filteredCards.length} cards
    </span>
    {#if totalPages > 1}
      <span>Page {currentPage} of {totalPages}</span>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    {#each paginatedCards as card (card.serial)}
      <CardItem {card} />
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
