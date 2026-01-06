<script lang="ts">
  import type { Card } from '$lib/server/types';
  import CardItem from './CardItem.svelte';

  interface Filters {
    setCode: string;
    colorIdentity: string[];
    cardType: '' | 'Normal' | 'Holo' | 'Foil';
    inStockOnly: boolean;
    isNew: boolean;
  }

  interface Props {
    cards: Card[];
    searchQuery: string;
    filters: Filters;
  }

  let { cards, searchQuery, filters }: Props = $props();

  const filteredCards = $derived(() => {
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

      // Card type filter
      if (filters.cardType && card.card_type !== filters.cardType) {
        return false;
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
</script>

{#if filteredCards().length === 0}
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <p class="text-xl font-medium">No cards found</p>
    <p class="mt-2 text-muted-foreground">
      Try adjusting your search or filters
    </p>
  </div>
{:else}
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    {#each filteredCards() as card (card.serial)}
      <CardItem {card} />
    {/each}
  </div>
{/if}
