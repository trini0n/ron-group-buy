<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import * as Card from '$components/ui/card';
  import * as Table from '$components/ui/table';
  import { Badge } from '$components/ui/badge';
  import { Save, DollarSign, RotateCcw } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  // Display order for card types
  const TYPE_ORDER = ['Normal', 'Holo', 'Foil', 'Raised Foil', 'Serialized'];

  type PricingRow = { card_type: string; price: number };

  // Local editable copy — populated and kept in sync by the $effect below
  let localPricing = $state<PricingRow[]>([]);

  // Keep in sync if data is invalidated
  $effect(() => {
    localPricing = [...data.pricing].sort(
      (a, b) =>
        (TYPE_ORDER.indexOf(a.card_type) + 1 || 99) -
        (TYPE_ORDER.indexOf(b.card_type) + 1 || 99)
    );
  });

  let isSaving = $state(false);
  let isDirty = $derived(
    localPricing.some((row) => {
      const original = data.pricing.find((p: PricingRow) => p.card_type === row.card_type);
      return original && Number(original.price) !== Number(row.price);
    })
  );

  function resetPrices() {
    localPricing = [...data.pricing].sort(
      (a, b) =>
        (TYPE_ORDER.indexOf(a.card_type) + 1 || 99) -
        (TYPE_ORDER.indexOf(b.card_type) + 1 || 99)
    );
  }

  async function savePrices() {
    const hasInvalid = localPricing.some((r) => isNaN(r.price) || r.price < 0);
    if (hasInvalid) {
      toast.error('All prices must be valid non-negative numbers');
      return;
    }

    isSaving = true;
    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localPricing.map((r) => ({ card_type: r.card_type, price: Number(r.price) })))
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Prices updated (${result.updated} types). Pending orders backfilled.`);
        await invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to save prices');
      }
    } catch {
      toast.error('Failed to save prices');
    } finally {
      isSaving = false;
    }
  }

  const BADGE_CLASSES: Record<string, string> = {
    Normal: 'bg-zinc-200 text-zinc-800',
    Holo: 'bg-violet-200 text-violet-800',
    Foil: 'bg-amber-200 text-amber-800',
    'Raised Foil': 'bg-rose-200 text-rose-800',
    Serialized: 'bg-yellow-200 text-yellow-800'
  };
</script>

<div class="p-8 max-w-2xl">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">Card Type Pricing</h1>
      <p class="text-muted-foreground">
        Set prices per card type. Changes take effect immediately in the store and are
        backfilled to all pending orders in the active group buy.
      </p>
    </div>
  </div>

  <Card.Root>
    <Card.Header>
      <div class="flex items-center gap-2">
        <DollarSign class="h-5 w-5 text-primary" />
        <Card.Title>Prices by Card Type</Card.Title>
      </div>
      <Card.Description>
        Edit the price for each finish type. Click Save to apply.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Card Type</Table.Head>
            <Table.Head class="w-40">Price (USD)</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each localPricing as row (row.card_type)}
            {@const badgeClass = BADGE_CLASSES[row.card_type] ?? 'bg-secondary text-secondary-foreground'}
            {@const original = data.pricing.find((p: PricingRow) => p.card_type === row.card_type)}
            {@const changed = original && Number(original.price) !== Number(row.price)}
            <Table.Row>
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                    {row.card_type}
                  </span>
                  {#if changed}
                    <span class="text-xs text-amber-600 dark:text-amber-400">
                      was ${Number(original!.price).toFixed(2)}
                    </span>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    class="pl-7 w-32"
                    bind:value={row.price}
                  />
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Content>
    <Card.Footer class="flex gap-2 justify-end border-t pt-4">
      {#if isDirty}
        <Button variant="outline" onclick={resetPrices} disabled={isSaving}>
          <RotateCcw class="mr-2 h-4 w-4" />
          Reset
        </Button>
      {/if}
      <Button onclick={savePrices} disabled={isSaving || !isDirty}>
        {#if isSaving}
          Saving...
        {:else}
          <Save class="mr-2 h-4 w-4" />
          Save Prices
        {/if}
      </Button>
    </Card.Footer>
  </Card.Root>
</div>
