<script lang="ts">
  import * as Dialog from '$components/ui/dialog';
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import { ShoppingCart, AlertTriangle, Check, X } from 'lucide-svelte';
  import { formatPrice } from '$lib/utils';
  import type { MergeStatus } from '$lib/stores/cart.svelte';

  interface Props {
    open: boolean;
    mergeStatus: MergeStatus | null;
    onConfirm: () => void;
    onSkip: () => void;
  }

  let { open = $bindable(), mergeStatus, onConfirm, onSkip }: Props = $props();

  const preview = $derived(mergeStatus?.preview);
  const details = $derived(preview?.details);
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-lg">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <ShoppingCart class="h-5 w-5" />
        Merge Your Cart?
      </Dialog.Title>
      <Dialog.Description>
        You have items from a previous browsing session. Would you like to add them to your cart?
      </Dialog.Description>
    </Dialog.Header>

    {#if preview && details}
      <div class="space-y-4">
        <!-- Summary -->
        <div class="rounded-lg bg-muted p-4">
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-green-600">{preview.items_to_add}</div>
              <div class="text-xs text-muted-foreground">Items to add</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-blue-600">{preview.items_to_combine}</div>
              <div class="text-xs text-muted-foreground">Items to combine</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-amber-600">{preview.items_to_remove}</div>
              <div class="text-xs text-muted-foreground">Unavailable</div>
            </div>
          </div>
        </div>

        <!-- Details -->
        <div class="max-h-60 space-y-3 overflow-y-auto">
          {#if details.items_added?.length}
            <div>
              <h4 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-green-600">
                <Check class="h-3.5 w-3.5" />
                New items to add
              </h4>
              <ul class="space-y-1 text-sm">
                {#each details.items_added as item}
                  <li class="flex items-center justify-between text-muted-foreground">
                    <span>{item.card_name} × {item.quantity}</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if details.items_combined?.length}
            <div>
              <h4 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-blue-600">
                <ShoppingCart class="h-3.5 w-3.5" />
                Quantities to combine
              </h4>
              <ul class="space-y-1 text-sm">
                {#each details.items_combined as item}
                  <li class="text-muted-foreground">
                    {item.card_name}: {item.previous_quantity} + {item.added_quantity} = {item.new_quantity}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if details.items_removed?.length}
            <div>
              <h4 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-600">
                <AlertTriangle class="h-3.5 w-3.5" />
                Unavailable items
              </h4>
              <ul class="space-y-1 text-sm">
                {#each details.items_removed as item}
                  <li class="text-muted-foreground">
                    {item.card_name} × {item.quantity}
                    <Badge variant="secondary" class="ml-1 text-xs">{item.reason}</Badge>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if details.qty_adjusted?.length}
            <div>
              <h4 class="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-600">
                <AlertTriangle class="h-3.5 w-3.5" />
                Quantity adjusted
              </h4>
              <ul class="space-y-1 text-sm">
                {#each details.qty_adjusted as item}
                  <li class="text-muted-foreground">
                    {item.card_name}: Requested {item.requested_quantity}, adjusted to {item.adjusted_quantity}
                    <Badge variant="secondary" class="ml-1 text-xs">{item.reason}</Badge>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="text-sm text-muted-foreground">
        <p>Found {mergeStatus?.guest_cart_items || 0} items from your previous session.</p>
      </div>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" onclick={onSkip}>
        <X class="mr-2 h-4 w-4" />
        Skip
      </Button>
      <Button onclick={onConfirm}>
        <Check class="mr-2 h-4 w-4" />
        Merge Items
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
