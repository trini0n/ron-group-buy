<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { Badge } from '$components/ui/badge';
  import * as Card from '$components/ui/card';
  import { Separator } from '$components/ui/separator';
  import { cartStore } from '$lib/stores/cart.svelte';
  import { formatPrice, getCardPrice, getFinishLabel, getFinishBadgeClasses } from '$lib/utils';
  import { toast } from 'svelte-sonner';
  import {
    Search,
    Loader2,
    ShoppingCart,
    ExternalLink,
    ChevronLeft,
    ChevronRight
  } from 'lucide-svelte';
  import { Textarea } from '$components/ui/textarea';
  import * as Accordion from '$components/ui/accordion';

  // Types
  interface DeckCard {
    quantity: number;
    name: string;
    set?: string;
    collectorNumber?: string;
    boardType?: 'commanders' | 'companions' | 'mainboard' | 'sideboard';
    typeLine?: string;
    foil?: boolean;
  }

  interface MoxfieldCard {
    quantity: number;
    boardType: string;
    card: {
      name: string;
      set: string;
      cn: string;
      type_line?: string;
    };
  }

  interface MoxfieldBoard {
    count: number;
    cards: Record<string, MoxfieldCard>;
  }

  interface MoxfieldBoards {
    mainboard: MoxfieldBoard;
    sideboard: MoxfieldBoard;
    commanders: MoxfieldBoard;
    companions: MoxfieldBoard;
  }

  interface MoxfieldDeck {
    name: string;
    boards: MoxfieldBoards;
    mainboard?: Record<string, MoxfieldCard>;
    sideboard?: Record<string, MoxfieldCard>;
    commanders?: Record<string, MoxfieldCard>;
    companions?: Record<string, MoxfieldCard>;
  }

  interface ArchidektCard {
    quantity: number;
    card: {
      oracleCard: {
        name: string;
        type?: string;
        typeLine?: string;
        types?: string[];
      };
      edition: {
        editioncode: string;
      };
      collectorNumber: string;
      typeLine?: string;
    };
    categories?: string[];
  }

  interface ArchidektDeck {
    name: string;
    cards: ArchidektCard[];
  }

  interface CardMatch {
    id: string;
    serial: string;
    card_name: string;
    set_code: string;
    set_name: string;
    collector_number: string | null;
    card_type: string;
    foil_type: string | null;
    is_in_stock: boolean;
    scryfall_id: string | null;
  }

  interface SearchResult {
    requestedCard: DeckCard;
    exactMatch: CardMatch | null;
    alternatives: CardMatch[];
    selected: CardMatch | null;
  }

  // Board type ordering
  const BOARD_ORDER: Record<string, number> = {
    commanders: 0,
    companions: 1,
    mainboard: 2,
    sideboard: 3
  };

  const BOARD_LABELS: Record<string, string> = {
    commanders: 'Commander',
    companions: 'Companion',
    mainboard: 'Mainboard',
    sideboard: 'Sideboard'
  };

  // Card type ordering (primary types extracted from type_line)
  const TYPE_ORDER: Record<string, number> = {
    Creature: 0,
    Planeswalker: 1,
    Artifact: 2,
    Enchantment: 3,
    Instant: 4,
    Sorcery: 5,
    Land: 6,
    Other: 7
  };

  // State
  let deckUrl = $state('');
  let pasteContent = $state('');
  let isLoading = $state(false);
  let isParsing = $state(false);
  let searchResults = $state<SearchResult[]>([]);
  let deckName = $state('');
  let deckSource = $state<'moxfield' | 'archidekt' | null>(null);
  
  // Progress tracking
  let totalCardsToSearch = $state(0);
  let cardsSearched = $state(0);
  const searchProgress = $derived(totalCardsToSearch > 0 ? Math.round((cardsSearched / totalCardsToSearch) * 100) : 0);

  // Track carousel index for each card
  let carouselIndices = $state<Map<number, number>>(new Map());

  // Track which cards are selected for adding to cart
  let selectedCards = $state<Map<number, CardMatch>>(new Map());

  const totalSelected = $derived(selectedCards.size);
  const totalQuantity = $derived(
    Array.from(selectedCards.entries()).reduce((sum, [idx]) => {
      return sum + (searchResults[idx]?.requestedCard.quantity || 0);
    }, 0)
  );

  // Group and sort results
  const groupedResults = $derived.by(() => {
    if (searchResults.length === 0) return [];

    // Group by board type
    const boards = new Map<string, { results: Array<{ result: SearchResult; originalIdx: number }>; cardTypes: Map<string, Array<{ result: SearchResult; originalIdx: number }>> }>();

    searchResults.forEach((result, originalIdx) => {
      const boardType = result.requestedCard.boardType || 'mainboard';
      const typeLine = result.requestedCard.typeLine || '';
      const cardType = extractPrimaryType(typeLine);

      if (!boards.has(boardType)) {
        boards.set(boardType, { results: [], cardTypes: new Map() });
      }

      const board = boards.get(boardType)!;
      board.results.push({ result, originalIdx });

      if (!board.cardTypes.has(cardType)) {
        board.cardTypes.set(cardType, []);
      }
      board.cardTypes.get(cardType)!.push({ result, originalIdx });
    });

    // Sort boards by order and card types within each board
    const sortedBoards: Array<{
      boardType: string;
      label: string;
      cardTypes: Array<{
        type: string;
        cards: Array<{ result: SearchResult; originalIdx: number }>;
      }>;
    }> = [];

    const boardKeys = Array.from(boards.keys()).sort((a, b) => (BOARD_ORDER[a] ?? 99) - (BOARD_ORDER[b] ?? 99));

    for (const boardType of boardKeys) {
      const board = boards.get(boardType)!;
      const sortedTypes: Array<{ type: string; cards: Array<{ result: SearchResult; originalIdx: number }> }> = [];

      const typeKeys = Array.from(board.cardTypes.keys()).sort((a, b) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99));

      for (const type of typeKeys) {
        const cards = board.cardTypes.get(type)!;
        // Sort alphabetically by card name
        cards.sort((a, b) => a.result.requestedCard.name.localeCompare(b.result.requestedCard.name));
        sortedTypes.push({ type, cards });
      }

      sortedBoards.push({
        boardType,
        label: BOARD_LABELS[boardType] || boardType,
        cardTypes: sortedTypes
      });
    }

    return sortedBoards;
  });

  function extractPrimaryType(typeLine: string): string {
    if (!typeLine) return 'Other';

    // Remove everything after the em dash (subtypes)
    const mainPart = typeLine.split('—')[0].trim();
    // Remove supertypes
    const types = mainPart.replace(/\b(Legendary|Basic|Snow|World|Tribal)\b/gi, '').trim();

    // Check for primary types
    if (types.includes('Creature')) return 'Creature';
    if (types.includes('Planeswalker')) return 'Planeswalker';
    if (types.includes('Artifact')) return 'Artifact';
    if (types.includes('Enchantment')) return 'Enchantment';
    if (types.includes('Instant')) return 'Instant';
    if (types.includes('Sorcery')) return 'Sorcery';
    if (types.includes('Land')) return 'Land';

    return 'Other';
  }

  function detectDeckSource(url: string): 'moxfield' | 'archidekt' | null {
    if (url.includes('moxfield.com')) return 'moxfield';
    if (url.includes('archidekt.com')) return 'archidekt';
    return null;
  }

  async function fetchMoxfieldDeckClient(url: string): Promise<{ name: string; cards: DeckCard[] }> {
    const match = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error('Invalid Moxfield URL');

    const deckId = match[1];
    const apiUrl = `https://api2.moxfield.com/v3/decks/all/${deckId}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

    const response = await fetch(proxyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch deck (status ${response.status})`);
    }

    const deck: MoxfieldDeck = await response.json();
    const cards: DeckCard[] = [];

    const hasBoards = deck.boards && deck.boards.mainboard;

    const getCards = (zone: MoxfieldBoard | Record<string, MoxfieldCard> | undefined): Record<string, MoxfieldCard> => {
      if (!zone) return {};
      if ('cards' in zone && typeof zone.cards === 'object') {
        return zone.cards as Record<string, MoxfieldCard>;
      }
      return zone as Record<string, MoxfieldCard>;
    };

    const boardTypes: Array<{ zone: MoxfieldBoard | Record<string, MoxfieldCard> | undefined; type: DeckCard['boardType'] }> = hasBoards
      ? [
          { zone: deck.boards.commanders, type: 'commanders' },
          { zone: deck.boards.companions, type: 'companions' },
          { zone: deck.boards.mainboard, type: 'mainboard' },
          { zone: deck.boards.sideboard, type: 'sideboard' }
        ]
      : [
          { zone: deck.commanders, type: 'commanders' },
          { zone: deck.companions, type: 'companions' },
          { zone: deck.mainboard, type: 'mainboard' },
          { zone: deck.sideboard, type: 'sideboard' }
        ];

    for (const { zone, type } of boardTypes) {
      const cardsMap = getCards(zone);
      for (const [, entry] of Object.entries(cardsMap)) {
        if (!entry.card) continue;
        cards.push({
          quantity: entry.quantity,
          name: entry.card.name,
          set: entry.card.set?.toUpperCase(),
          collectorNumber: entry.card.cn,
          boardType: type,
          typeLine: entry.card.type_line
        });
      }
    }

    return { name: deck.name, cards };
  }

  async function fetchArchidektDeckClient(url: string): Promise<{ name: string; cards: DeckCard[] }> {
    const match = url.match(/archidekt\.com\/decks\/(\d+)/);
    if (!match) throw new Error('Invalid Archidekt URL');

    const deckId = match[1];
    const apiUrl = `https://archidekt.com/api/decks/${deckId}/`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

    const response = await fetch(proxyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch deck (status ${response.status})`);
    }

    const deck: ArchidektDeck = await response.json();
    const cards: DeckCard[] = [];
    const seenCards = new Set<string>();

    for (const entry of deck.cards || []) {
      const cardName = entry.card.oracleCard.name;
      
      // Deduplicate - Archidekt lists the same card in multiple categories
      if (seenCards.has(cardName)) continue;
      seenCards.add(cardName);
      
      // Archidekt uses categories for board type
      const categories = entry.categories || [];
      let boardType: DeckCard['boardType'] = 'mainboard';
      if (categories.includes('Commander')) boardType = 'commanders';
      else if (categories.includes('Companion')) boardType = 'companions';
      else if (categories.includes('Sideboard') || categories.includes('Maybeboard')) boardType = 'sideboard';

      // Get type line from various possible sources
      let typeLine = entry.card.typeLine 
        || entry.card.oracleCard.typeLine 
        || entry.card.oracleCard.type 
        || '';
      
      // If still empty, try to infer from categories
      if (!typeLine) {
        if (categories.includes('Creature') || categories.includes('Creatures')) typeLine = 'Creature';
        else if (categories.includes('Instant') || categories.includes('Instants')) typeLine = 'Instant';
        else if (categories.includes('Sorcery') || categories.includes('Sorceries')) typeLine = 'Sorcery';
        else if (categories.includes('Artifact') || categories.includes('Artifacts')) typeLine = 'Artifact';
        else if (categories.includes('Enchantment') || categories.includes('Enchantments')) typeLine = 'Enchantment';
        else if (categories.includes('Planeswalker') || categories.includes('Planeswalkers')) typeLine = 'Planeswalker';
        else if (categories.includes('Land') || categories.includes('Lands')) typeLine = 'Land';
      }

      cards.push({
        quantity: entry.quantity,
        name: cardName,
        set: entry.card.edition?.editioncode?.toUpperCase(),
        collectorNumber: entry.card.collectorNumber,
        boardType,
        typeLine
      });
    }

    return { name: deck.name, cards };
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
    carouselIndices = new Map();
    totalCardsToSearch = 0;
    cardsSearched = 0;

    try {
      let data: { name: string; cards: DeckCard[] };

      if (source === 'moxfield') {
        data = await fetchMoxfieldDeckClient(deckUrl);
      } else {
        data = await fetchArchidektDeckClient(deckUrl);
      }

      deckName = data.name || 'Imported Deck';
      isParsing = true;
      totalCardsToSearch = data.cards.length;
      
      // Batch cards for progress tracking (batches of 10)
      const BATCH_SIZE = 10;
      const batches: DeckCard[][] = [];
      for (let i = 0; i < data.cards.length; i += BATCH_SIZE) {
        batches.push(data.cards.slice(i, i + BATCH_SIZE));
      }
      
      const allResults: SearchResult[] = [];
      
      for (const batch of batches) {
        const searchResponse = await fetch('/api/import/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: batch })
        });

        if (!searchResponse.ok) {
          throw new Error('Failed to search for cards');
        }

        const batchResults: SearchResult[] = await searchResponse.json();
        allResults.push(...batchResults);
        cardsSearched = allResults.length;
      }
      
      searchResults = allResults;

      // Auto-select exact matches that are in stock
      const newSelected = new Map<number, CardMatch>();
      const newCarouselIndices = new Map<number, number>();
      allResults.forEach((result, idx) => {
        newCarouselIndices.set(idx, 0);
        if (result.exactMatch && result.exactMatch.is_in_stock) {
          newSelected.set(idx, result.exactMatch);
        }
      });
      selectedCards = newSelected;
      carouselIndices = newCarouselIndices;

      const matchCount = allResults.filter((r) => r.exactMatch || r.alternatives.length > 0).length;
      const inStock = allResults.filter((r) => r.exactMatch?.is_in_stock || r.alternatives.some(a => a.is_in_stock)).length;
      toast.success(`Found ${matchCount} matches (${inStock} in stock) out of ${allResults.length} cards`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import deck');
    } finally {
      isLoading = false;
      isParsing = false;
      totalCardsToSearch = 0;
      cardsSearched = 0;
    }
  }

  function parseDeckList(text: string): DeckCard[] {
    const cards: DeckCard[] = [];
    const lines = text.split('\n');
    
    // Regex logic: Priority for strictly formatted lines
    // ^(\d+) -> Quantity
    // \s+(.+?) -> Name (non-greedy)
    // (?:\s+\(([a-zA-Z0-9]+)\)(?:\s+([a-zA-Z0-9]+))?)? -> Optional Set group: (set) followed optionally by CN
    // (?:\s+\*(.+?)\*)? -> Optional Foil group
    // $ -> End of line check
    const regex = /^(\d+)\s+(.+?)(?:\s+\(([a-zA-Z0-9]+)\)(?:\s+([a-zA-Z0-9]+))?)?(?:\s+\*(.+?)\*)?$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(regex);
      if (match) {
        const [, qty, name, set, cn, foil] = match;
        cards.push({
          quantity: parseInt(qty),
          name: name.trim(),
          set: set?.toUpperCase(),
          collectorNumber: cn,
          boardType: 'mainboard',
          foil: !!foil
        });
      } else {
        // Fallback for simple "1 Card Name"
        // Try to match simpler pattern "Qty Name"
        const simpleRegex = /^(\d+)\s+(.+)$/;
        const simpleMatch = trimmed.match(simpleRegex);
        if (simpleMatch) {
            cards.push({
                quantity: parseInt(simpleMatch[1]),
                name: simpleMatch[2].trim(),
                boardType: 'mainboard'
            });
        }
      }
    }
    return cards;
  }

  async function importPastedDeck() {
    if (!pasteContent.trim()) {
      toast.error('Please paste a decklist');
      return;
    }

    isLoading = true;
    searchResults = [];
    selectedCards = new Map();
    carouselIndices = new Map();
    totalCardsToSearch = 0;
    cardsSearched = 0;
    deckName = 'Pasted Deck';
    deckSource = null;

    try {
      const cards = parseDeckList(pasteContent);
      if (cards.length === 0) {
        toast.error('No valid cards found in text');
        isLoading = false;
        return;
      }

      isParsing = true;
      totalCardsToSearch = cards.length;
      
      const BATCH_SIZE = 10;
      const batches: DeckCard[][] = [];
      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        batches.push(cards.slice(i, i + BATCH_SIZE));
      }
      
      const allResults: SearchResult[] = [];
      
      for (const batch of batches) {
        const searchResponse = await fetch('/api/import/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: batch })
        });

        if (!searchResponse.ok) {
          throw new Error('Failed to search for cards');
        }

        const batchResults: SearchResult[] = await searchResponse.json();
        allResults.push(...batchResults);
        cardsSearched = allResults.length;
      }
      
      searchResults = allResults;

      // Auto-select exact matches that are in stock
      const newSelected = new Map<number, CardMatch>();
      const newCarouselIndices = new Map<number, number>();
      allResults.forEach((result, idx) => {
        newCarouselIndices.set(idx, 0);
        if (result.exactMatch && result.exactMatch.is_in_stock) {
          newSelected.set(idx, result.exactMatch);
        }
      });
      selectedCards = newSelected;
      carouselIndices = newCarouselIndices;

      const matchCount = allResults.filter((r) => r.exactMatch || r.alternatives.length > 0).length;
      const inStock = allResults.filter((r) => r.exactMatch?.is_in_stock || r.alternatives.some(a => a.is_in_stock)).length;
      toast.success(`Found ${matchCount} matches (${inStock} in stock) out of ${allResults.length} cards`);

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import deck');
    } finally {
      isLoading = false;
      isParsing = false;
    }
  }

  function getAllOptions(result: SearchResult): CardMatch[] {
    const options: CardMatch[] = [];
    if (result.exactMatch) options.push(result.exactMatch);
    options.push(...result.alternatives.filter((a) => a.id !== result.exactMatch?.id));
    return options;
  }

  function getCarouselIndex(idx: number): number {
    return carouselIndices.get(idx) || 0;
  }

  function nextOption(idx: number, result: SearchResult) {
    const options = getAllOptions(result);
    if (options.length <= 1) return;
    const current = getCarouselIndex(idx);
    const next = (current + 1) % options.length;
    carouselIndices = new Map(carouselIndices).set(idx, next);
    // Update selection if the card was selected
    if (selectedCards.has(idx)) {
      selectedCards = new Map(selectedCards).set(idx, options[next]);
    }
  }

  function prevOption(idx: number, result: SearchResult) {
    const options = getAllOptions(result);
    if (options.length <= 1) return;
    const current = getCarouselIndex(idx);
    const prev = (current - 1 + options.length) % options.length;
    carouselIndices = new Map(carouselIndices).set(idx, prev);
    // Update selection if the card was selected
    if (selectedCards.has(idx)) {
      selectedCards = new Map(selectedCards).set(idx, options[prev]);
    }
  }

  function getCurrentOption(idx: number, result: SearchResult): CardMatch | null {
    const options = getAllOptions(result);
    if (options.length === 0) return null;
    const carouselIdx = getCarouselIndex(idx);
    return options[carouselIdx] || options[0];
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

  function selectAllInStock() {
    const newSelected = new Map<number, CardMatch>();
    searchResults.forEach((result, idx) => {
      const options = getAllOptions(result);
      const inStockOption = options.find((o) => o.is_in_stock);
      if (inStockOption) {
        newSelected.set(idx, inStockOption);
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
    selectedCards = new Map();
  }

  function getCardImageUrl(scryfallId: string | null, size: 'small' | 'normal' = 'normal'): string {
    if (!scryfallId) return '/placeholder-card.png';
    return `https://cards.scryfall.io/${size}/front/${scryfallId.charAt(0)}/${scryfallId.charAt(1)}/${scryfallId}.jpg`;
  }

  function getSellerInfo(card: CardMatch): string {
    // Extract seller info from serial if available
    const parts = card.serial?.split('_') || [];
    return parts[0] || 'Unknown';
  }
</script>

<svelte:head>
  <title>Import Deck - Group Buy</title>
</svelte:head>

<div class="container max-w-7xl py-8">
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
          {#if isLoading && deckUrl}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            {isParsing ? 'Searching...' : 'Fetching...'}
          {:else}
            <Search class="mr-2 h-4 w-4" />
            Import URL
          {/if}
        </Button>
      </div>

      <p class="mt-2 text-sm text-muted-foreground">
        Import a deck from Moxfield or Archidekt above
      </p>

      <!-- Paste Decklist Option -->
      <div class="mt-4">
        <Accordion.Root type="single" collapsible>
          <Accordion.Item value="paste">
            <Accordion.Trigger class="text-sm text-muted-foreground hover:no-underline">
              Or paste a decklist below instead...
            </Accordion.Trigger>
            <Accordion.Content>
              <div class="space-y-4 pt-2">
                <div class="space-y-2">
                  <Label for="decklist">Decklist</Label>
                  <p class="text-xs text-muted-foreground">
                    Format: <code>[qty] [name] ([set]) [cn] *[foil]*</code>. Set, CN, and Foil are optional.
                  </p>
                  <Textarea
                    id="decklist"
                    placeholder={'1 Ancient Copper Dragon (clb) 161 *F*\n1 Sol Ring'}
                    class="h-[200px] font-mono"
                    bind:value={pasteContent}
                    disabled={isLoading}
                  />
                </div>
                <Button onclick={importPastedDeck} disabled={isLoading || !pasteContent.trim()}>
                  {#if isLoading && !deckUrl}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  {:else}
                    Import List
                  {/if}
                </Button>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </div>
      
      <!-- Progress bar during search -->
      {#if isParsing && totalCardsToSearch > 0}
        <div class="mt-4 space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Searching inventory...</span>
            <span class="font-medium">{cardsSearched} / {totalCardsToSearch} cards</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div 
              class="h-full bg-primary transition-all duration-300 ease-out"
              style="width: {searchProgress}%"
            ></div>
          </div>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Results -->
  {#if searchResults.length > 0}
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold">{deckName}</h2>
        <p class="text-sm text-muted-foreground">
          {searchResults.length} cards • {totalSelected} selected ({totalQuantity} total quantity)
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onclick={selectAllInStock}>
          Select All In Stock
        </Button>
        <Button variant="ghost" size="sm" onclick={clearSelection}>
          Clear Selection
        </Button>
      </div>
    </div>

    <!-- Legend -->
    <div class="mb-6 flex flex-wrap gap-6 text-sm">
      <div class="flex items-center gap-2">
        <div class="h-3 w-3 rounded-full bg-green-500"></div>
        <span>In stock</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="h-3 w-3 rounded-full bg-yellow-500"></div>
        <span>Out of stock</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="h-3 w-3 rounded-full bg-red-500"></div>
        <span>Not found</span>
      </div>
    </div>

    <!-- Grouped Results -->
    {#each groupedResults as board}
      <div class="mb-8">
        <h3 class="mb-4 text-lg font-semibold border-b pb-2">{board.label}</h3>

        {#each board.cardTypes as cardTypeGroup}
          <div class="mb-6">
            <h4 class="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {cardTypeGroup.type} ({cardTypeGroup.cards.length})
            </h4>

            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {#each cardTypeGroup.cards as { result, originalIdx }}
                {@const options = getAllOptions(result)}
                {@const hasOptions = options.length > 0}
                {@const currentOption = getCurrentOption(originalIdx, result)}
                {@const isSelected = selectedCards.has(originalIdx)}
                {@const carouselIdx = getCarouselIndex(originalIdx)}

                <div
                  class="relative rounded-lg border-2 transition-all {isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'}"
                >
                  <!-- Card Image Container -->
                  <div class="relative aspect-[488/680] overflow-hidden rounded-t-md bg-muted group">
                    {#if hasOptions && currentOption}
                      <img
                        src={getCardImageUrl(currentOption.scryfall_id)}
                        alt={currentOption.card_name}
                        class="h-full w-full object-cover {!currentOption.is_in_stock ? 'opacity-50 grayscale' : ''}"
                        loading="lazy"
                      />
                      
                      <!-- Left carousel click zone (15% width) -->
                      {#if options.length > 1}
                        <button
                          onclick={(e) => { e.stopPropagation(); prevOption(originalIdx, result); }}
                          class="absolute left-0 top-0 h-full w-[15%] flex items-center justify-start pl-1 hover:bg-black/30 transition-all cursor-pointer"
                          aria-label="Previous card option"
                        >
                          <ChevronLeft class="h-6 w-6 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] [text-shadow:0_0_4px_rgba(0,0,0,0.9)]" />
                        </button>
                      {/if}
                      
                      <!-- Center click zone for selection -->
                      <button
                        onclick={() => currentOption?.is_in_stock && toggleCardSelection(originalIdx, currentOption)}
                        class="absolute left-[15%] top-0 h-full w-[70%] cursor-pointer"
                        disabled={!currentOption?.is_in_stock}
                        aria-label="Select card"
                      ></button>
                      
                      <!-- Right carousel click zone (15% width) -->
                      {#if options.length > 1}
                        <button
                          onclick={(e) => { e.stopPropagation(); nextOption(originalIdx, result); }}
                          class="absolute right-0 top-0 h-full w-[15%] flex items-center justify-end pr-1 hover:bg-black/30 transition-all cursor-pointer"
                          aria-label="Next card option"
                        >
                          <ChevronRight class="h-6 w-6 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] [text-shadow:0_0_4px_rgba(0,0,0,0.9)]" />
                        </button>
                      {/if}
                      
                      <!-- Stock indicator -->
                      <div
                        class="absolute top-2 right-2 h-3 w-3 rounded-full {currentOption.is_in_stock
                          ? 'bg-green-500'
                          : 'bg-yellow-500'}"
                      ></div>
                      
                      <!-- Quantity badge -->
                      {#if result.requestedCard.quantity > 1}
                        <Badge variant="secondary" class="absolute top-2 left-2 text-xs">x{result.requestedCard.quantity}</Badge>
                      {/if}
                      
                      <!-- Carousel position indicator -->
                      {#if options.length > 1}
                        <div class="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                          {carouselIdx + 1} / {options.length}
                        </div>
                      {/if}
                    {:else}
                      <div class="flex h-full items-center justify-center text-muted-foreground">
                        <div class="text-center p-4">
                          <span class="text-2xl">✕</span>
                          <p class="text-xs mt-2">Not found</p>
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- Card Info (clickable for selection) -->
                  <button
                    onclick={() => hasOptions && currentOption?.is_in_stock && toggleCardSelection(originalIdx, currentOption)}
                    class="w-full p-2 space-y-1 text-left {hasOptions && currentOption?.is_in_stock ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'}"
                    disabled={!hasOptions || !currentOption?.is_in_stock}
                  >
                    <p class="text-xs font-medium truncate" title={result.requestedCard.name}>
                      {result.requestedCard.name}
                    </p>
                    {#if hasOptions && currentOption}
                      <div class="flex items-center gap-1 flex-wrap">
                        <span class="text-xs text-muted-foreground">
                          [{currentOption.set_code} #{currentOption.collector_number}]
                        </span>
                        <Badge class="text-[10px] px-1 py-0 {getFinishBadgeClasses(getFinishLabel(currentOption))}">
                          {getFinishLabel(currentOption)}
                        </Badge>
                      </div>
                    {/if}
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/each}

    <!-- Add to Cart Button -->
    <div class="sticky bottom-4 flex justify-center">
      <Button size="lg" onclick={addSelectedToCart} disabled={totalSelected === 0} class="shadow-lg">
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
