<script lang="ts">
  import { Button } from '$components/ui/button'
  import { Input } from '$components/ui/input'
  import { Badge } from '$components/ui/badge'
  import { Textarea } from '$components/ui/textarea'
  import * as Table from '$components/ui/table'
  import { invalidateAll } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import { Plus, Pencil, Trash2, Check, X, Library, Upload, AlertCircle } from 'lucide-svelte'

  let { data } = $props()

  // ── Create form ──────────────────────────────────────────────
  const SET_TYPES = ['Normal', 'Holo / Mixed', 'Foil'] as const
  let showCreateForm = $state(false)
  let newSetCode = $state('')
  let newSetName = $state('')
  let newSetPrice = $state('')
  let newSetType = $state<string>('Normal')
  let createLoading = $state(false)

  async function createSet() {
    if (!newSetCode.trim() || !newSetName.trim()) {
      toast.error('Set ID and name are required')
      return
    }
    const price = newSetPrice.trim()
      ? parseFloat(newSetPrice.trim().replace(/[^0-9.]/g, ''))
      : undefined
    if (newSetPrice.trim() && (isNaN(price!) || price! < 0)) {
      toast.error('Invalid price — use a number like 65 or 65.00')
      return
    }
    createLoading = true
    try {
      const res = await fetch('/api/admin/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set_code: newSetCode.trim(),
          set_name: newSetName.trim(),
          set_type: newSetType,
          ...(price !== undefined ? { price } : {})
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }))
        toast.error(err.message ?? `Failed to create set (${res.status})`)
        return
      }
      toast.success(`Set ${newSetCode.trim().toUpperCase()} created`)
      newSetCode = ''
      newSetName = ''
      newSetPrice = ''
      newSetType = 'Normal'
      showCreateForm = false
      await invalidateAll()
    } catch {
      toast.error('Network error creating set')
    } finally {
      createLoading = false
    }
  }

  // ── Inline edit ───────────────────────────────────────────────
  let editingCode = $state<string | null>(null)
  let editName = $state('')
  let editPrice = $state('')
  let editType = $state<string>('Normal')
  let editLoading = $state(false)

  function startEdit(setCode: string, currentName: string, currentPrice: number | null, currentType: string) {
    editingCode = setCode
    editName = currentName
    editPrice = currentPrice != null ? String(currentPrice) : ''
    editType = currentType
  }

  function cancelEdit() {
    editingCode = null
    editName = ''
    editPrice = ''
    editType = 'Normal'
  }

  async function saveEdit(setCode: string) {
    if (!editName.trim()) { toast.error('Name cannot be empty'); return }
    const price = editPrice.trim()
      ? parseFloat(editPrice.trim().replace(/[^0-9.]/g, ''))
      : null
    if (editPrice.trim() && (isNaN(price!) || price! < 0)) {
      toast.error('Invalid price')
      return
    }
    editLoading = true
    try {
      const res = await fetch(`/api/admin/sets/${encodeURIComponent(setCode)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_name: editName.trim(), price: price, set_type: editType })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }))
        toast.error(err.message ?? `Failed to update set (${res.status})`)
        return
      }
      toast.success('Set updated')
      editingCode = null
      await invalidateAll()
    } catch {
      toast.error('Network error updating set')
    } finally {
      editLoading = false
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  let deleteLoading = $state<string | null>(null)

  async function deleteSet(setCode: string, setName: string) {
    const cardCount = data.sets.find((s) => s.set_code === setCode)?.card_count ?? 0
    if (!window.confirm(`Delete set "${setName}" (${setCode})? This will also remove all ${cardCount} card associations.`)) return
    deleteLoading = setCode
    try {
      const res = await fetch(`/api/admin/sets/${encodeURIComponent(setCode)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }))
        toast.error(err.message ?? `Failed to delete set (${res.status})`)
        return
      }
      toast.success(`Set ${setCode} deleted`)
      await invalidateAll()
    } catch {
      toast.error('Network error deleting set')
    } finally {
      deleteLoading = null
    }
  }

  // ── Bulk import ───────────────────────────────────────────────
  let showBulkForm = $state(false)
  let bulkLines = $state('')
  let bulkLoading = $state(false)
  let bulkErrors = $state<Array<{ line: string; reason: string }>>([])

  async function bulkImport() {
    const lines = bulkLines
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      toast.error('No lines to import')
      return
    }

    bulkLoading = true
    bulkErrors = []

    try {
      const res = await fetch('/api/admin/sets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines })
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.message ?? `Error (${res.status})`)
        return
      }

      const { created, updated, errors } = result as {
        created: number
        updated: number
        errors: Array<{ line: string; reason: string }>
      }

      bulkErrors = errors

      const parts: string[] = []
      if (created > 0) parts.push(`${created} created`)
      if (updated > 0) parts.push(`${updated} updated`)

      if (parts.length > 0) {
        toast.success(parts.join(', '))
        bulkLines = ''
        await invalidateAll()
      }

      if (errors.length > 0 && created === 0 && updated === 0) {
        toast.error(`Import failed — ${errors.length} line${errors.length !== 1 ? 's' : ''} had errors`)
      } else if (errors.length > 0) {
        toast.warning(`${errors.length} line${errors.length !== 1 ? 's' : ''} skipped`)
      }
    } catch {
      toast.error('Network error during bulk import')
    } finally {
      bulkLoading = false
    }
  }

  const lineCount = $derived(bulkLines.split('\n').filter((l) => l.trim()).length)
</script>

<svelte:head>
  <title>Sets — Admin</title>
</svelte:head>

<div class="p-6 max-w-5xl mx-auto space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Library class="h-6 w-6 text-muted-foreground" />
      <div>
        <h1 class="text-2xl font-semibold">Sets</h1>
        <p class="text-sm text-muted-foreground">{data.sets.length} set{data.sets.length !== 1 ? 's' : ''} defined</p>
      </div>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" onclick={() => { showBulkForm = !showBulkForm; showCreateForm = false }}>
        <Upload class="h-4 w-4 mr-2" />
        Bulk Import
      </Button>
      <Button onclick={() => { showCreateForm = !showCreateForm; showBulkForm = false }}>
        <Plus class="h-4 w-4 mr-2" />
        Add Set
      </Button>
    </div>
  </div>

  <!-- Single create form -->
  {#if showCreateForm}
    <div class="border rounded-lg p-4 bg-muted/30 space-y-3">
      <h2 class="text-sm font-medium">New Set</h2>
      <div class="flex gap-3">
        <Input
          id="new-set-code"
          placeholder="Short ID (e.g. NPFOIL42)"
          bind:value={newSetCode}
          class="w-40 font-mono uppercase"
          onkeydown={(e) => e.key === 'Enter' && createSet()}
        />
        <Input
          id="new-set-name"
          placeholder="Display name (e.g. NP Foil 42 Set (65$))"
          bind:value={newSetName}
          class="flex-1"
          onkeydown={(e) => e.key === 'Enter' && createSet()}
        />
        <Input
          id="new-set-price"
          placeholder="Price (e.g. 65)"
          bind:value={newSetPrice}
          class="w-28"
          type="text"
          inputmode="decimal"
          onkeydown={(e) => e.key === 'Enter' && createSet()}
        />
        <select
          id="new-set-type"
          bind:value={newSetType}
          class="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {#each SET_TYPES as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
        <Button onclick={createSet} disabled={createLoading}>
          {createLoading ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" onclick={() => { showCreateForm = false; newSetCode = ''; newSetName = ''; newSetPrice = ''; newSetType = 'Normal' }}>
          Cancel
        </Button>
      </div>
    </div>
  {/if}

  <!-- Bulk import form -->
  {#if showBulkForm}
    <div class="border rounded-lg overflow-hidden">
      <div class="px-4 py-3 bg-muted/30 border-b">
        <h2 class="text-sm font-medium">Bulk Import</h2>
        <p class="text-xs text-muted-foreground mt-0.5">
          Paste rows from a spreadsheet — each row is
          <code class="font-mono bg-muted px-1 rounded">setCode [TAB] setName [TAB] price</code>.
          Price is optional. Existing set codes will be updated.
        </p>
      </div>
      <div class="p-4 space-y-3">
        <Textarea
          id="bulk-import-textarea"
          bind:value={bulkLines}
          placeholder={"NPFOIL42\tNP Foil 42 Set (65$)\t65\nNPFOIL41\tNP Foil 41 Set (65$)\t65\nNPMIXED5\tNP Mixed 5 Set (65$)\t65\nJKHOLO4\tJK Holo 4 Set (65$)\t65"}
          rows={8}
          class="font-mono text-sm resize-y"
        />
        <div class="flex items-center gap-2">
          <Button onclick={bulkImport} disabled={bulkLoading || !bulkLines.trim()}>
            {bulkLoading ? 'Importing…' : `Import ${lineCount > 0 ? lineCount + ' set' + (lineCount !== 1 ? 's' : '') : ''}`}
          </Button>
          <Button variant="ghost" onclick={() => { bulkLines = ''; bulkErrors = [] }} disabled={bulkLoading}>
            Clear
          </Button>
          <span class="text-xs text-muted-foreground ml-auto">{lineCount} row{lineCount !== 1 ? 's' : ''}</span>
        </div>

        {#if bulkErrors.length > 0}
          <div class="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <p class="text-xs font-medium text-destructive flex items-center gap-1.5">
              <AlertCircle class="h-3.5 w-3.5" />
              {bulkErrors.length} row{bulkErrors.length !== 1 ? 's' : ''} had errors:
            </p>
            {#each bulkErrors as err}
              <p class="text-xs font-mono text-destructive/80">
                <span class="font-semibold">{err.line}</span>
                <span class="text-muted-foreground ml-2">— {err.reason}</span>
              </p>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Sets table -->
  {#if data.sets.length === 0}
    <div class="border rounded-lg p-12 text-center text-muted-foreground">
      <Library class="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p class="text-sm">No sets yet. Click <strong>Add Set</strong> or <strong>Bulk Import</strong>.</p>
    </div>
  {:else}
    <div class="border rounded-lg overflow-hidden">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-28">Code</Table.Head>
            <Table.Head>Name</Table.Head>
            <Table.Head class="w-28">Type</Table.Head>
            <Table.Head class="w-24 text-right">Price</Table.Head>
            <Table.Head class="w-20 text-right">Cards</Table.Head>
            <Table.Head class="w-28 text-right">Actions</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.sets as set (set.set_code)}
            <Table.Row>
              <Table.Cell>
                <Badge variant="secondary" class="font-mono text-xs">{set.set_code}</Badge>
              </Table.Cell>
              <Table.Cell>
                {#if editingCode === set.set_code}
                  <div class="flex items-center gap-2">
                    <Input
                      bind:value={editName}
                      class="h-7 text-sm flex-1"
                      placeholder="Set name"
                      onkeydown={(e) => {
                        if (e.key === 'Enter') saveEdit(set.set_code)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                    />
                    <Input
                      bind:value={editPrice}
                      class="h-7 text-sm w-20"
                      placeholder="Price"
                      type="text"
                      inputmode="decimal"
                      onkeydown={(e) => {
                        if (e.key === 'Enter') saveEdit(set.set_code)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                    />
                    <select
                      bind:value={editType}
                      class="h-7 rounded border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {#each SET_TYPES as t}
                        <option value={t}>{t}</option>
                      {/each}
                    </select>
                    <button
                      class="text-green-600 hover:text-green-700 disabled:opacity-50 shrink-0"
                      onclick={() => saveEdit(set.set_code)}
                      disabled={editLoading}
                      aria-label="Save"
                    >
                      <Check class="h-4 w-4" />
                    </button>
                    <button
                      class="text-muted-foreground hover:text-foreground shrink-0"
                      onclick={cancelEdit}
                      aria-label="Cancel"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                {:else}
                  <a href="/admin/sets/{set.set_code}" class="font-medium hover:underline">
                    {set.set_name}
                  </a>
                {/if}
              </Table.Cell>
              <!-- Type column (only visible when not editing) -->
              <Table.Cell class="text-sm text-muted-foreground">
                {#if editingCode !== set.set_code}
                  {set.set_type ?? 'Normal'}
                {/if}
              </Table.Cell>
              <Table.Cell class="text-right text-sm">
                {#if editingCode !== set.set_code}
                  {set.price != null ? `$${Number(set.price).toFixed(2)}` : '—'}
                {/if}
              </Table.Cell>
              <Table.Cell class="text-right text-sm text-muted-foreground">
                {set.card_count}
              </Table.Cell>
              <Table.Cell class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    onclick={() => startEdit(set.set_code, set.set_name, set.price ?? null, set.set_type ?? 'Normal')}
                    aria-label="Edit {set.set_name}"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </button>
                  <button
                    class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-40"
                    onclick={() => deleteSet(set.set_code, set.set_name)}
                    disabled={deleteLoading === set.set_code}
                    aria-label="Delete {set.set_name}"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/if}
</div>
