<script lang="ts">
  import { cn } from '$lib/utils';
  import { Check } from 'lucide-svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLInputAttributes, 'type'> {
    checked?: boolean;
  }

  let { class: className, checked = $bindable(false), ...restProps }: Props = $props();
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked}
  class={cn(
    'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
    className
  )}
  data-state={checked ? 'checked' : 'unchecked'}
  onclick={() => (checked = !checked)}
  {...restProps}
>
  {#if checked}
    <Check class="h-4 w-4" />
  {/if}
</button>
