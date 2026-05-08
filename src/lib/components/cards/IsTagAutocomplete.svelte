<script lang="ts">
  import { ORACLE_TAGS, ORACLE_TAG_LABELS, matchesOracleTag } from '$lib/data/oracle-tags'
  import type { Card } from '$lib/server/types'

  let {
    query,
    onselect,
    cards = null
  }: { query: string; onselect: (newQuery: string) => void; cards?: Card[] | null } = $props()

  let dropdownEl: HTMLDivElement | null = $state(null)
  let dismissedAtQuery = $state('')

  // Extract partial tag text when query ends with an is: token (e.g. "is:sh" → "sh", "is:" → "")
  // Returns null when query does not end with an is: token.
  const partialText = $derived((/is:(\S*)$/i.exec(query) ?? [])[1]?.toLowerCase() ?? null)

  // Tags that have at least one card in the library — computed once when cards load.
  // Falls back to all tags when cards haven't loaded yet (null).
  const availableTags = $derived(
    cards !== null
      ? Object.keys(ORACLE_TAGS)
          .filter((tag) => cards.some((c) => matchesOracleTag(c.card_name, tag)))
          .sort()
      : Object.keys(ORACLE_TAGS).sort()
  )

  // Filter to tags whose key starts with the typed partial text
  const filteredTags = $derived(
    partialText !== null ? availableTags.filter((t) => t.startsWith(partialText)) : []
  )

  // Visible when: partial token present, matching tags exist, and user hasn't dismissed this exact query
  const visible = $derived(
    partialText !== null && filteredTags.length > 0 && query !== dismissedAtQuery
  )

  function handleSelect(tag: string) {
    // Replace the trailing is:partial token with is:tag + space.
    // Appending a space means the query no longer ends with an is: token,
    // so partialText will be null on next render and the dropdown closes naturally.
    onselect(query.replace(/is:\S*$/i, 'is:' + tag + ' '))
  }

  // Dismiss on click outside the dropdown
  $effect(() => {
    function handleMousedown(e: MouseEvent) {
      if (dropdownEl && !dropdownEl.contains(e.target as Node)) {
        dismissedAtQuery = query
      }
    }
    document.addEventListener('mousedown', handleMousedown)
    return () => document.removeEventListener('mousedown', handleMousedown)
  })
</script>

{#if visible}
  <div
    bind:this={dropdownEl}
    class="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md"
  >
    {#each filteredTags as tag (tag)}
      <button
        type="button"
        class="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
        onmousedown={(e) => {
          // Use mousedown (fires before blur) so the selection registers before input loses focus
          e.preventDefault()
          handleSelect(tag)
        }}
      >
        <span>{ORACLE_TAG_LABELS[tag] ?? tag}</span>
        <span class="ml-4 text-xs text-muted-foreground">is:{tag}</span>
      </button>
    {/each}
  </div>
{/if}
