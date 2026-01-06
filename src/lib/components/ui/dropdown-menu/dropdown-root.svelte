<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
  let open = $state(false);
</script>

<div class="relative inline-block text-left">
  {@render children()}
</div>
