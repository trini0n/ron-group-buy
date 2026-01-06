<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    value?: string;
    children: Snippet;
  }

  let { value = $bindable(''), children }: Props = $props();
</script>

<div class="relative" data-value={value}>
  {@render children()}
</div>
