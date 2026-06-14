<script lang="ts">
  import { Button } from '$components/ui/button'
  import { Badge } from '$components/ui/badge'
  import { Textarea } from '$components/ui/textarea'
  import * as Table from '$components/ui/table'
  import { invalidateAll } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import { ArrowLeft, Trash2, Plus, Library, AlertCircle } from 'lucide-svelte'

  let { data } = $props()

  // ── Add cards ─────────────────────────────────────────────────
  let addLines = $state('')
  let addLoading = $state(false)
  let addErrors = $state<Array<{ line: string; reason: string }>>([])
  let showAddSection = $state(true)

  async function addCards() {
    const lines = addLines
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      toast.error('No lines to add')
      return
    }

    addLoading = true
    addErrors = []

    try {
      const res = await fetch(
        `/api/admin/sets/${encodeURIComponent(data.set.set_code)}/cards`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines })
        }
      )

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.message ?? `Error (${res.status})`)
        return
      }

      const { added, already_present, errors } = result as {
        added: number
        already_present: number
        errors: Array<{ line: string; reason: string }>
      }

      addErrors = errors

      if (added > 0 || already_present > 0) {
        const parts: string[] = []
        if (added > 0) parts.push(`${added} card${added !== 1 ? 's' : ''} added`)
        if (already_present > 0) parts.push(`${already_present} already in set`)
        toast.success(parts.join(', '))
        if (added > 0) {
          addLines = ''
          await invalidateAll()
        }
      }

      if (errors.length > 0 && added === 0 && already_present === 0) {
        toast.error(`No cards added — ${errors.length} line${errors.length !== 1 ? 's' : ''} failed`)
      } else if (errors.length > 0) {
        toast.warning(`${errors.length} line${errors.length !== 1 ? 's' : ''} could not be resolved`)
      }
    } catch {
      toast.error('Network error adding cards')
    } finally {
      addLoading = false
    }
  }

  // ── Remove card ───────────────────────────────────────────────
  let removingId = $state<string | null>(null)

  async function removeCard(cardId: string, cardName: string) {
    removingId = cardId
    try {
      const res = await fetch(
        `/api/admin/sets/${encodeURIComponent(data.set.set_code)}/cards/${encodeURIComponent(cardId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        toast.error(`Failed to remove ${cardName}`)
        return
      }
      toast.success(`Removed ${cardName} from set`)
      await invalidateAll()
    } catch {
      toast.error('Network error removing card')
    } finally {
      removingId = null
    }
  }
</script>

<svelte:head>
  <title>{data.set.set_name} — Sets — Admin</title>
</svelte:head>

<div class="p-6 max-w-5xl mx-auto space-y-6">
  <!-- Breadcrumb + header -->
  <div class="space-y-1">
    <a
      href="/admin/sets"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft class="h-3.5 w-3.5" />
      Back to Sets
    </a>
    <div class="flex items-start gap-3">
      <Library class="h-6 w-6 text-muted-foreground mt-1 shrink-0" />
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-semibold">{data.set.set_name}</h1>
          <Badge variant="secondary" class="font-mono text-xs">{data.set.set_code}</Badge>
        </div>
        <p class="text-sm text-muted-foreground">
          {data.cards.length} card{data.cards.length !== 1 ? 's' : ''} in this set
        </p>
      </div>
    </div>
  </div>

  <!-- Add Cards section -->
  <div class="border rounded-lg overflow-hidden">
    <button
      class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      onclick={() => { showAddSection = !showAddSection }}
      aria-expanded={showAddSection}
    >
      <span class="flex items-center gap-2">
        <Plus class="h-4 w-4" />
        Add Cards
      </span>
      <span class="text-muted-foreground text-xs">{showAddSection ? '▲' : '▼'}</span>
    </button>

    {#if showAddSection}
      <div class="border-t p-4 space-y-3 bg-muted/20">
        <p class="text-xs text-muted-foreground">
          Paste one card per line in <code class="font-mono bg-muted px-1 rounded">setCode collectorNumber [lang]</code> format.
          Language defaults to <code class="font-mono bg-muted px-1 rounded">en</code> if omitted.
        </p>
        <Textarea
          id="add-cards-textarea"
          bind:value={addLines}
          placeholder={'MKM 123 en\nMKM 124\nOTJ 45 ja\nDSK 201 de'}
          rows={6}
          class="font-mono text-sm resize-y"
        />
        <div class="flex items-center gap-2">
          <Button onclick={addCards} disabled={addLoading || !addLines.trim()}>
            {#if addLoading}
              Adding…
            {:else}
              Add Cards
            {/if}
          </Button>
          <Button
            variant="ghost"
            onclick={() => { addLines = ''; addErrors = [] }}
            disabled={addLoading}
          >
            Clear
          </Button>
          <span class="text-xs text-muted-foreground ml-auto">
            {addLines.split('\n').filter((l) => l.trim()).length} line{addLines.split('\n').filter((l) => l.trim()).length !== 1 ? 's' : ''}
          </span>
        </div>

        <!-- Per-line errors -->
        {#if addErrors.length > 0}
          <div class="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <p class="text-xs font-medium text-destructive flex items-center gap-1.5">
              <AlertCircle class="h-3.5 w-3.5" />
              {addErrors.length} line{addErrors.length !== 1 ? 's' : ''} could not be resolved:
            </p>
            {#each addErrors as err}
              <p class="text-xs font-mono text-destructive/80">
                <span class="font-semibold">{err.line}</span>
                <span class="text-muted-foreground ml-2">— {err.reason}</span>
              </p>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Cards table -->
  <div class="space-y-2">
    <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">
      Cards in Set
    </h2>

    {#if data.cards.length === 0}
      <div class="border rounded-lg p-10 text-center text-muted-foreground">
        <Library class="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p class="text-sm">No cards in this set yet.</p>
        <p class="text-xs mt-1">Paste card lines above to add them.</p>
      </div>
    {:else}
      <div class="border rounded-lg overflow-hidden">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head class="w-20">Set</Table.Head>
              <Table.Head class="w-20">Coll#</Table.Head>
              <Table.Head class="w-16">Lang</Table.Head>
              <Table.Head>Card Name</Table.Head>
              <Table.Head class="w-24">Type</Table.Head>
              <Table.Head class="w-24">Serial</Table.Head>
              <Table.Head class="w-16 text-right">Remove</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each data.cards as card (card.card_id)}
              <Table.Row>
                <Table.Cell>
                  <Badge variant="outline" class="font-mono text-xs">{card.set_code}</Badge>
                </Table.Cell>
                <Table.Cell class="font-mono text-sm text-muted-foreground">
                  {card.collector_number}
                </Table.Cell>
                <Table.Cell class="text-sm text-muted-foreground">
                  {card.language}
                </Table.Cell>
                <Table.Cell>
                  <a
                    href="/card/{card.set_code}/{card.collector_number}"
                    class="font-medium hover:underline text-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {card.card_name}
                  </a>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="secondary" class="text-xs">{card.card_type}</Badge>
                </Table.Cell>
                <Table.Cell class="font-mono text-xs text-muted-foreground">
                  {card.serial}
                </Table.Cell>
                <Table.Cell class="text-right">
                  <button
                    class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-40 transition-colors"
                    onclick={() => removeCard(card.card_id, card.card_name)}
                    disabled={removingId === card.card_id}
                    aria-label="Remove {card.card_name} from set"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    {/if}
  </div>
</div>
