<script lang="ts">
  import { Button } from '$components/ui/button'
  import { Input } from '$components/ui/input'
  import { Badge } from '$components/ui/badge'
  import * as Table from '$components/ui/table'
  import { invalidateAll } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import { Plus, Pencil, Trash2, Check, X, Library } from 'lucide-svelte'

  let { data } = $props()

  // ── Create form ──────────────────────────────────────────────
  let showCreateForm = $state(false)
  let newSetCode = $state('')
  let newSetName = $state('')
  let createLoading = $state(false)

  async function createSet() {
    if (!newSetCode.trim() || !newSetName.trim()) {
      toast.error('Set code and name are required')
      return
    }
    createLoading = true
    try {
      const res = await fetch('/api/admin/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_code: newSetCode.trim(), set_name: newSetName.trim() })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }))
        toast.error(err.message ?? `Failed to create set (${res.status})`)
        return
      }
      toast.success(`Set ${newSetCode.trim().toUpperCase()} created`)
      newSetCode = ''
      newSetName = ''
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
  let editLoading = $state(false)

  function startEdit(setCode: string, currentName: string) {
    editingCode = setCode
    editName = currentName
  }

  function cancelEdit() {
    editingCode = null
    editName = ''
  }

  async function saveEdit(setCode: string) {
    if (!editName.trim()) { toast.error('Name cannot be empty'); return }
    editLoading = true
    try {
      const res = await fetch(`/api/admin/sets/${encodeURIComponent(setCode)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_name: editName.trim() })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }))
        toast.error(err.message ?? `Failed to update set (${res.status})`)
        return
      }
      toast.success('Set name updated')
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
    if (!window.confirm(`Delete set "${setName}" (${setCode})? This will also remove all ${data.sets.find(s => s.set_code === setCode)?.card_count ?? 0} card associations.`)) return
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
</script>

<svelte:head>
  <title>Sets — Admin</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Library class="h-6 w-6 text-muted-foreground" />
      <div>
        <h1 class="text-2xl font-semibold">Sets</h1>
        <p class="text-sm text-muted-foreground">{data.sets.length} set{data.sets.length !== 1 ? 's' : ''} defined</p>
      </div>
    </div>
    <Button onclick={() => { showCreateForm = !showCreateForm }}>
      <Plus class="h-4 w-4 mr-2" />
      Add Set
    </Button>
  </div>

  <!-- Create form -->
  {#if showCreateForm}
    <div class="border rounded-lg p-4 bg-muted/30 space-y-3">
      <h2 class="text-sm font-medium">New Set</h2>
      <div class="flex gap-3">
        <Input
          id="new-set-code"
          placeholder="Set code (e.g. MKM)"
          bind:value={newSetCode}
          class="w-36 font-mono uppercase"
          onkeydown={(e) => e.key === 'Enter' && createSet()}
        />
        <Input
          id="new-set-name"
          placeholder="Set name (e.g. Murders at Karlov Manor)"
          bind:value={newSetName}
          class="flex-1"
          onkeydown={(e) => e.key === 'Enter' && createSet()}
        />
        <Button onclick={createSet} disabled={createLoading}>
          {#if createLoading}Saving…{:else}Save{/if}
        </Button>
        <Button variant="ghost" onclick={() => { showCreateForm = false; newSetCode = ''; newSetName = '' }}>
          Cancel
        </Button>
      </div>
    </div>
  {/if}

  <!-- Sets table -->
  {#if data.sets.length === 0}
    <div class="border rounded-lg p-12 text-center text-muted-foreground">
      <Library class="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p class="text-sm">No sets yet. Click <strong>Add Set</strong> to create one.</p>
    </div>
  {:else}
    <div class="border rounded-lg overflow-hidden">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-28">Code</Table.Head>
            <Table.Head>Name</Table.Head>
            <Table.Head class="w-24 text-right">Cards</Table.Head>
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
                      class="h-7 text-sm"
                      onkeydown={(e) => {
                        if (e.key === 'Enter') saveEdit(set.set_code)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                    />
                    <button
                      class="text-green-600 hover:text-green-700 disabled:opacity-50"
                      onclick={() => saveEdit(set.set_code)}
                      disabled={editLoading}
                      aria-label="Save set name"
                    >
                      <Check class="h-4 w-4" />
                    </button>
                    <button
                      class="text-muted-foreground hover:text-foreground"
                      onclick={cancelEdit}
                      aria-label="Cancel edit"
                    >
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                {:else}
                  <a
                    href="/admin/sets/{set.set_code}"
                    class="font-medium hover:underline"
                  >
                    {set.set_name}
                  </a>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-right text-sm text-muted-foreground">
                {set.card_count}
              </Table.Cell>
              <Table.Cell class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    onclick={() => startEdit(set.set_code, set.set_name)}
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
