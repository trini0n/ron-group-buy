<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Snippet } from 'svelte';

  interface Props {
    align?: 'start' | 'center' | 'end';
    class?: string;
    children: Snippet;
  }

  let { align = 'center', class: className, children }: Props = $props();
</script>

<div
  class={cn(
    'absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
    align === 'end' && 'right-0',
    align === 'start' && 'left-0',
    className
  )}
>
  {@render children()}
</div>
