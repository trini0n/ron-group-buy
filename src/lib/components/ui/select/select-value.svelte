<script lang="ts">
  interface Props {
    placeholder?: string;
  }

  let { placeholder = 'Select...' }: Props = $props();
</script>

<span class="pointer-events-none">{placeholder}</span>
