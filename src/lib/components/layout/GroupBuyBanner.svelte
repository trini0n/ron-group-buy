<script lang="ts">
  import type { GroupBuyConfig } from '$lib/server/types';
  import { X } from 'lucide-svelte';
  import { Button } from '$components/ui/button';

  interface Props {
    config: GroupBuyConfig | null;
  }

  let { config }: Props = $props();
  let dismissed = $state(false);

  const isOpen = $derived(() => {
    if (!config) return false;
    const now = new Date();
    const opens = config.opens_at ? new Date(config.opens_at) : null;
    const closes = config.closes_at ? new Date(config.closes_at) : null;
    
    if (opens && now < opens) return false;
    if (closes && now > closes) return false;
    return config.is_active;
  });

  const closesAt = $derived(() => {
    if (!config?.closes_at) return null;
    return new Date(config.closes_at);
  });

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
</script>

{#if !dismissed}
  {#if config && isOpen()}
    <!-- Group Buy Open Banner -->
    <div class="bg-green-600 px-4 py-2 text-center text-sm text-white">
      <div class="container flex items-center justify-center gap-4">
        <span>
          🛒 <strong>{config.name}</strong> is open!
          {#if closesAt()}
            Closes {formatDate(closesAt()!)}.
          {/if}
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          class="h-6 w-6 text-white hover:bg-green-700"
          onclick={() => dismissed = true}
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>
  {:else if config && !isOpen()}
    <!-- Group Buy Closed Banner -->
    <div class="bg-amber-600 px-4 py-2 text-center text-sm text-white">
      <div class="container flex items-center justify-center gap-4">
        <span>
          ⏳ Group Buy is currently closed. Checkout is disabled.
        </span>
        <Button 
          variant="ghost" 
          size="icon" 
          class="h-6 w-6 text-white hover:bg-amber-700"
          onclick={() => dismissed = true}
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
    </div>
  {/if}
{/if}
