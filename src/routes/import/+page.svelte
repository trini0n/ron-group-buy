<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { Badge } from '$components/ui/badge';
  import { Checkbox } from '$components/ui/checkbox';
  import * as Card from '$components/ui/card';
  import * as Table from '$components/ui/table';
  import * as Tooltip from '$components/ui/tooltip';
  import { Separator } from '$components/ui/separator';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { formatPrice, getCardPrice, getFinishLabel, getFinishBadgeClasses } from '$lib/utils';
  import { toast } from 'svelte-sonner';
  import {
    Search,
    Loader2,
    Check,
    X,
    AlertTriangle,
    ShoppingCart,
    ExternalLink,
    HelpCircle
  } from 'lucide-svelte';

  interface DeckCard {
    quantity: number;
    name: string;
    set?: string;
    collectorNumber?: string;
  }

  interface CardMatch {
    id: string;
    serial: string;
    card_name: string;
    set_code: string;
    set_name: string;
    collector_number: string | null;
    card_type: string;
    is_in_stock: boolean;
    scryfall_id: string | null;
  }

  interface SearchResult {
    requestedCard: DeckCard;
    exactMatch: CardMatch | null;
    alternatives: CardMatch[];
    selected: CardMatch | null;
  }

  let deckUrl = $state('');
  let isLoading = $state(false);
  let isParsing = $state(false);
  let searchResults = $state<SearchResult[]>([]);
  let deckName = $state('');
  let deckSource = $state<'moxfield' | 'archidekt' | null>(null);

  // Track which cards are selected for adding to cart
  let selectedCards = $state<Map<number, CardMatch>>(new Map());

  const totalSelected = $derived(selectedCards.size);
  const totalQuantity = $derived(
    Array.from(selectedCards.entries()).reduce((sum, [idx]) => {
      return sum + (searchResults[idx]?.requestedCard.quantity || 0);
    }, 0)
  );

  function detectDeckSource(url: string): 'moxfield' | 'archidekt' | null {
    if (url.includes('moxfield.com')) return 'moxfield';
    if (url.includes('archidekt.com')) return 'archidekt';
    return null;
  }

  async function fetchDeck() {
    if (!deckUrl.trim()) {
      toast.error('Please enter a deck URL');
      return;
    }

    const source = detectDeckSource(deckUrl);
    if (!source) {
      toast.error('Please enter a valid Moxfield or Archidekt URL');
      return;
    }

    deckSource = source;
    isLoading = true;
    searchResults = [];
    selectedCards = new Map();

    try {
      // Fetch deck from our API
      const response = await fetch('/api/import/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: deckUrl, source })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch deck');
      }

      const data = await response.json();
      deckName = data.name || 'Imported Deck';
      
      // Now search for each card in our database
      isParsing = true;
      const cards: DeckCard[] = data.cards;

      const searchResponse = await fetch('/api/import/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards })
      });

      if (!searchResponse.ok) {
        throw new Error('Failed to search for cards');
      }

      const results: SearchResult[] = await searchResponse.json();
      searchResults = results;

      // Auto-select exact matches that are in stock
      const newSelected = new Map<number, CardMatch>();
      results.forEach((result, idx) => {
        if (result.exactMatch && result.exactMatch.is_in_stock) {
          newSelected.set(idx, result.exactMatch);
        }
      });
      selectedCards = newSelected;

      const exactMatches = results.filter((r) => r.exactMatch).length;
      const inStock = results.filter((r) => r.exactMatch?.is_in_stock).length;
      toast.success(`Found ${exactMatches} exact matches (${inStock} in stock) out of ${results.length} cards`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import deck');
    } finally {
      isLoading = false;
      isParsing = false;
    }
  }

  function toggleCardSelection(idx: number, card: CardMatch | null) {
    if (!card) return;

    const newSelected = new Map(selectedCards);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.set(idx, card);
    }
    selectedCards = newSelected;
  }

  function selectAlternative(idx: number, card: CardMatch) {
    const newSelected = new Map(selectedCards);
    newSelected.set(idx, card);
    selectedCards = newSelected;
  }

  function selectAllExactMatches() {
    const newSelected = new Map<number, CardMatch>();
    searchResults.forEach((result, idx) => {
      if (result.exactMatch && result.exactMatch.is_in_stock) {
        newSelected.set(idx, result.exactMatch);
      }
    });
    selectedCards = newSelected;
    toast.success(`Selected ${newSelected.size} exact matches`);
  }

  function selectAllInStock() {
    const newSelected = new Map<number, CardMatch>();
    searchResults.forEach((result, idx) => {
      // Prefer exact match if in stock, otherwise first in-stock alternative
      if (result.exactMatch?.is_in_stock) {
        newSelected.set(idx, result.exactMatch);
      } else {
        const inStockAlt = result.alternatives.find((a) => a.is_in_stock);
        if (inStockAlt) {
          newSelected.set(idx, inStockAlt);
        }
      }
    });
    selectedCards = newSelected;
    toast.success(`Selected ${newSelected.size} in-stock cards`);
  }

  function clearSelection() {
    selectedCards = new Map();
  }

  async function addSelectedToCart() {
    if (selectedCards.size === 0) {
      toast.error('No cards selected');
      return;
    }

    let added = 0;
    for (const [idx, card] of selectedCards.entries()) {
      const quantity = searchResults[idx].requestedCard.quantity;
      await cartStore.addItem(card as any, quantity);
      added++;
    }

    toast.success(`Added ${added} cards to cart`);
    
    // Clear selection after adding
    selectedCards = new Map();
  }

  function getCardImageUrl(scryfallId: string | null): string {
    if (!scryfallId) return '/placeholder-card.png';
    return `https://cards.scryfall.io/small/front/${scryfallId.charAt(0)}/${scryfallId.charAt(1)}/${scryfallId}.jpg`;
  }
</script>

<svelte:head>
  <title>Import Deck - Group Buy</title>
</svelte:head>

<div class="container max-w-6xl py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold">Import Deck</h1>
    <p class="text-muted-foreground">
      Paste a Moxfield or Archidekt deck URL to find cards in our inventory
    </p>
  </div>

  <!-- URL Input -->
  <Card.Root class="mb-8">
    <Card.Content class="pt-6">
      <div class="flex gap-4">
        <div class="flex-1">
          <Label for="deckUrl" class="sr-only">Deck URL</Label>
          <Input
            id="deckUrl"
            type="url"
            placeholder="https://www.moxfield.com/decks/... or https://archidekt.com/decks/..."
            bind:value={deckUrl}
            onkeydown={(e) => e.key === 'Enter' && fetchDeck()}
            disabled={isLoading}
          />
        </div>
        <Button onclick={fetchDeck} disabled={isLoading || !deckUrl.trim()}>
          {#if isLoading}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            {isParsing ? 'Searching...' : 'Fetching...'}
          {:else}
            <Search class="mr-2 h-4 w-4" />
            Import Deck
          {/if}
        </Button>
      </div>
      <p class="mt-2 text-sm text-muted-foreground">
        Supports Moxfield and Archidekt deck URLs. We'll search our inventory for matching cards.
      </p>
    </Card.Content>
  </Card.Root>

  <!-- Results -->
  {#if searchResults.length > 0}
    <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold">{deckName}</h2>
        <p class="text-sm text-muted-foreground">
          {searchResults.length} cards • {totalSelected} selected ({totalQuantity} total quantity)
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onclick={selectAllExactMatches}>
          Select Exact Matches
        </Button>
        <Button variant="outline" size="sm" onclick={selectAllInStock}>
          Select All In Stock
        </Button>
        <Button variant="ghost" size="sm" onclick={clearSelection}>
          Clear Selection
        </Button>
      </div>
    </div>

    <!-- Legend -->
    <div class="mb-4 flex flex-wrap gap-4 text-sm">
      <div class="flex items-center gap-2">
        <div class="h-3 w-3 rounded-full bg-green-500"></div>
        <span>Exact match (in stock)</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="h-3 w-3 rounded-full bg-yellow-500"></div>
        <span>Alternative available</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="h-3 w-3 rounded-full bg-red-500"></div>
        <span>Not found / Out of stock</span>
      </div>
    </div>

    <!-- Results Table -->
    <div class="rounded-md border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-12">Qty</Table.Head>
            <Table.Head>Requested Card</Table.Head>
            <Table.Head>Match</Table.Head>
            <Table.Head>Set</Table.Head>
            <Table.Head>Type</Table.Head>
            <Table.Head class="text-right">Price</Table.Head>
            <Table.Head class="w-12">Add</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each searchResults as result, idx (idx)}
            {@const selectedCard = selectedCards.get(idx)}
            {@const hasMatch = result.exactMatch || result.alternatives.length > 0}
            {@const displayCard = selectedCard || result.exactMatch}
            <Table.Row class={!hasMatch ? 'bg-red-500/10' : ''}>
              <Table.Cell class="font-mono">{result.requestedCard.quantity}</Table.Cell>
              <Table.Cell>
                <div>
                  <p class="font-medium">{result.requestedCard.name}</p>
                  {#if result.requestedCard.set}
                    <p class="text-xs text-muted-foreground">
                      {result.requestedCard.set}
                      {#if result.requestedCard.collectorNumber}
                        #{result.requestedCard.collectorNumber}
                      {/if}
                    </p>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell>
                {#if displayCard}
                  <div class="flex items-center gap-2">
                    {#if result.exactMatch && displayCard.id === result.exactMatch.id}
                      <div class="h-2 w-2 rounded-full bg-green-500" title="Exact match"></div>
                    {:else}
                      <div class="h-2 w-2 rounded-full bg-yellow-500" title="Alternative"></div>
                    {/if}
                    <span class="font-medium">{displayCard.card_name}</span>
                    {#if !displayCard.is_in_stock}
                      <Badge variant="outline" class="text-red-500">Out of stock</Badge>
                    {/if}
                  </div>
                {:else if result.alternatives.length > 0}
                  <div class="flex items-center gap-2">
                    <div class="h-2 w-2 rounded-full bg-yellow-500"></div>
                    <span class="text-muted-foreground">
                      {result.alternatives.length} alternative{result.alternatives.length > 1 ? 's' : ''} available
                    </span>
                  </div>
                {:else}
                  <div class="flex items-center gap-2 text-red-500">
                    <X class="h-4 w-4" />
                    <span>Not found</span>
                  </div>
                {/if}

                <!-- Alternatives dropdown -->
                {#if result.alternatives.length > 0}
                  <div class="mt-1">
                    <select
                      class="w-full rounded border bg-background px-2 py-1 text-sm"
                      onchange={(e) => {
                        const target = e.target as HTMLSelectElement;
                        const card = result.alternatives.find((a) => a.id === target.value);
                        if (card) selectAlternative(idx, card);
                      }}
                    >
                      {#if result.exactMatch}
                        <option value={result.exactMatch.id} selected={selectedCard?.id === result.exactMatch.id}>
                          {result.exactMatch.set_code} - {result.exactMatch.card_type}
                          {result.exactMatch.is_in_stock ? '' : '(Out of stock)'}
                        </option>
                      {:else}
                        <option value="">Select a version...</option>
                      {/if}
                      {#each result.alternatives as alt}
                        <option value={alt.id} selected={selectedCard?.id === alt.id}>
                          {alt.set_code} #{alt.collector_number} - {alt.card_type}
                          {alt.is_in_stock ? '' : '(Out of stock)'}
                        </option>
                      {/each}
                    </select>
                  </div>
                {/if}
              </Table.Cell>
              <Table.Cell>
                {#if displayCard}
                  <span class="text-sm">{displayCard.set_code}</span>
                {:else}
                  <span class="text-muted-foreground">—</span>
                {/if}
              </Table.Cell>
              <Table.Cell>
                {#if displayCard}
                  <Badge class={getFinishBadgeClasses(displayCard.card_type)}>
                    {getFinishLabel({ card_type: displayCard.card_type })}
                  </Badge>
                {:else}
                  <span class="text-muted-foreground">—</span>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-right">
                {#if displayCard}
                  <span class="font-medium">
                    {formatPrice(getCardPrice(displayCard.card_type) * result.requestedCard.quantity)}
                  </span>
                {:else}
                  <span class="text-muted-foreground">—</span>
                {/if}
              </Table.Cell>
              <Table.Cell>
                {#if displayCard && displayCard.is_in_stock}
                  <Checkbox
                    checked={selectedCards.has(idx)}
                    onCheckedChange={() => toggleCardSelection(idx, displayCard)}
                  />
                {:else if displayCard}
                  <Tooltip.Root>
                    <Tooltip.Trigger>
                      <AlertTriangle class="h-4 w-4 text-yellow-500" />
                    </Tooltip.Trigger>
                    <Tooltip.Content>Out of stock</Tooltip.Content>
                  </Tooltip.Root>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>

    <!-- Add to Cart Button -->
    <div class="mt-6 flex justify-end">
      <Button size="lg" onclick={addSelectedToCart} disabled={totalSelected === 0}>
        <ShoppingCart class="mr-2 h-4 w-4" />
        Add {totalSelected} Cards to Cart
        {#if totalQuantity > 0}
          ({totalQuantity} total)
        {/if}
      </Button>
    </div>
  {:else if !isLoading}
    <!-- Empty State -->
    <Card.Root>
      <Card.Content class="flex flex-col items-center justify-center py-16">
        <Search class="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 class="text-lg font-medium">No deck imported yet</h3>
        <p class="mt-2 text-center text-muted-foreground">
          Enter a Moxfield or Archidekt deck URL above to search for cards in our inventory.
        </p>
        <div class="mt-4 flex gap-4">
          <a
            href="https://www.moxfield.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Moxfield <ExternalLink class="h-3 w-3" />
          </a>
          <a
            href="https://archidekt.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Archidekt <ExternalLink class="h-3 w-3" />
          </a>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}
</div>
