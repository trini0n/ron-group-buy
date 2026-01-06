<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    asChild?: boolean;
    children: Snippet<[{ builder: { action: (node: HTMLElement) => void } }]>;
  }

  let { asChild = false, children }: Props = $props();

  const builder = {
    action: (node: HTMLElement) => {
      // Add click handler for dropdown trigger
    }
  };
</script>

{@render children({ builder })}
