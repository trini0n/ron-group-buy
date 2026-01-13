<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { Badge } from '$components/ui/badge';
  import { Switch } from '$components/ui/switch';
  import * as Card from '$components/ui/card';
  import * as Dialog from '$components/ui/dialog';
  import * as Table from '$components/ui/table';
  import { Separator } from '$components/ui/separator';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import {
    Plus,
    Edit,
    Trash2,
    Calendar,
    Save,
    Power,
    PowerOff,
    Bell
  } from 'lucide-svelte';

  interface GroupBuyConfig {
    id: string;
    name: string;
    is_active: boolean | null;
    opens_at: string | null;
    closes_at: string | null;
    created_at: string | null;
  }

  let { data } = $props();

  let isCreating = $state(false);
  let editingConfig = $state<GroupBuyConfig | null>(null);
  let isSaving = $state(false);
  let isDeleting = $state(false);

  // Form state
  let formName = $state('');
  let formOpensAt = $state('');
  let formClosesAt = $state('');
  let formIsActive = $state(false);

  function openCreateDialog() {
    formName = '';
    formOpensAt = '';
    formClosesAt = '';
    formIsActive = false;
    editingConfig = null;
    isCreating = true;
  }

  function openEditDialog(config: GroupBuyConfig) {
    formName = config.name;
    formOpensAt = config.opens_at ? formatDateTimeLocal(config.opens_at) : '';
    formClosesAt = config.closes_at ? formatDateTimeLocal(config.closes_at) : '';
    formIsActive = config.is_active ?? false;
    editingConfig = config;
    isCreating = true;
  }

  function formatDateTimeLocal(isoString: string): string {
    const date = new Date(isoString);
    // Format as local time for datetime-local input (YYYY-MM-DDTHH:MM)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  async function handleSubmit() {
    if (!formName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    isSaving = true;

    try {
      const payload = {
        name: formName.trim(),
        opens_at: formOpensAt ? new Date(formOpensAt).toISOString() : null,
        closes_at: formClosesAt ? new Date(formClosesAt).toISOString() : null,
        is_active: formIsActive
      };

      const url = editingConfig 
        ? `/api/admin/config/${editingConfig.id}` 
        : '/api/admin/config';
      
      const response = await fetch(url, {
        method: editingConfig ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(editingConfig ? 'Group buy updated' : 'Group buy created');
        isCreating = false;
        editingConfig = null;
        invalidateAll();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save');
      }
    } catch (err) {
      toast.error('Failed to save group buy');
    } finally {
      isSaving = false;
    }
  }

  async function toggleActive(config: GroupBuyConfig) {
    try {
      const response = await fetch(`/api/admin/config/${config.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !config.is_active })
      });

      if (response.ok) {
        toast.success(config.is_active ? 'Group buy deactivated' : 'Group buy activated');
        invalidateAll();
      } else {
        toast.error('Failed to toggle status');
      }
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  }

  async function deleteConfig(config: GroupBuyConfig) {
    if (!confirm(`Are you sure you want to delete "${config.name}"?`)) {
      return;
    }

    isDeleting = true;

    try {
      const response = await fetch(`/api/admin/config/${config.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Group buy deleted');
        invalidateAll();
      } else {
        toast.error('Failed to delete');
      }
    } catch (err) {
      toast.error('Failed to delete group buy');
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="p-8">
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">Group Buy Settings</h1>
      <p class="text-muted-foreground">Manage group buy periods and settings</p>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" href="/admin/settings/notifications">
        <Bell class="mr-2 h-4 w-4" />
        Notification Templates
      </Button>
      <Button onclick={openCreateDialog}>
        <Plus class="mr-2 h-4 w-4" />
        Create Group Buy
      </Button>
    </div>
  </div>

  <!-- Active Config Highlight -->
  {#each data.configs.filter((c: GroupBuyConfig) => c.is_active) as config}
    {@const closesInPast = config.closes_at && new Date(config.closes_at) < new Date()}
    {@const opensInFuture = config.opens_at && new Date(config.opens_at) > new Date()}
    <Card.Root class="mb-8 border-green-500 bg-green-500/10">
      <Card.Header>
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <Power class="h-5 w-5 text-green-500" />
              Active Group Buy
            </Card.Title>
            <Card.Description>
              {#if closesInPast}
                <span class="text-amber-500">⚠️ Closed date is in the past - checkout is disabled!</span>
              {:else}
                Currently accepting orders
              {/if}
            </Card.Description>
          </div>
          <Badge class="bg-green-500">Active</Badge>
        </div>
      </Card.Header>
      <Card.Content>
        <dl class="grid gap-4 sm:grid-cols-3">
          <div>
            <dt class="text-sm text-muted-foreground">Name</dt>
            <dd class="font-medium">{config.name}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted-foreground">Opens</dt>
            <dd class="font-medium">{formatDate(config.opens_at)}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted-foreground">Closes</dt>
            <dd class="font-medium">{formatDate(config.closes_at)}</dd>
          </div>
        </dl>
      </Card.Content>
      <Card.Footer class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => openEditDialog(config)}>
          <Edit class="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onclick={() => toggleActive(config)}>
          <PowerOff class="mr-2 h-4 w-4" />
          Deactivate
        </Button>
      </Card.Footer>
    </Card.Root>
  {/each}

  <!-- All Configs Table -->
  <Card.Root>
    <Card.Header>
      <Card.Title>All Group Buys</Card.Title>
      <Card.Description>Past and upcoming group buy periods</Card.Description>
    </Card.Header>
    <Card.Content>
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Name</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Opens</Table.Head>
            <Table.Head>Closes</Table.Head>
            <Table.Head>Created</Table.Head>
            <Table.Head></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each data.configs as config}
            <Table.Row>
              <Table.Cell class="font-medium">{config.name}</Table.Cell>
              <Table.Cell>
                {#if config.is_active}
                  <Badge class="bg-green-500">Active</Badge>
                {:else}
                  <Badge variant="outline">Inactive</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-sm">{formatDate(config.opens_at)}</Table.Cell>
              <Table.Cell class="text-sm">{formatDate(config.closes_at)}</Table.Cell>
              <Table.Cell class="text-sm text-muted-foreground">
                {formatDate(config.created_at)}
              </Table.Cell>
              <Table.Cell>
                <div class="flex gap-1">
                  <Button variant="ghost" size="icon" onclick={() => openEditDialog(config)}>
                    <Edit class="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onclick={() => toggleActive(config)}>
                    {#if config.is_active}
                      <PowerOff class="h-4 w-4" />
                    {:else}
                      <Power class="h-4 w-4" />
                    {/if}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onclick={() => deleteConfig(config)}
                    disabled={config.is_active}
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell colspan={6} class="py-8 text-center text-muted-foreground">
                No group buys created yet
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Content>
  </Card.Root>
</div>

<!-- Create/Edit Dialog -->
<Dialog.Root bind:open={isCreating}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>{editingConfig ? 'Edit' : 'Create'} Group Buy</Dialog.Title>
      <Dialog.Description>
        {editingConfig 
          ? 'Update the group buy settings' 
          : 'Set up a new group buy period'}
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input 
            id="name" 
            placeholder="January 2026 Group Buy" 
            bind:value={formName}
            required
          />
        </div>

        <div class="space-y-2">
          <Label for="opens_at">Opens At (Optional)</Label>
          <Input 
            id="opens_at" 
            type="datetime-local" 
            bind:value={formOpensAt}
          />
          <p class="text-xs text-muted-foreground">
            Leave empty to open immediately when activated
          </p>
        </div>

        <div class="space-y-2">
          <Label for="closes_at">Closes At (Optional)</Label>
          <Input 
            id="closes_at" 
            type="datetime-local" 
            bind:value={formClosesAt}
          />
          <p class="text-xs text-muted-foreground">
            Leave empty for no deadline
          </p>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <Label for="is_active">Active</Label>
            <p class="text-xs text-muted-foreground">
              Enable to allow orders
            </p>
          </div>
          <Switch id="is_active" bind:checked={formIsActive} />
        </div>
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => isCreating = false}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {#if isSaving}
            Saving...
          {:else}
            <Save class="mr-2 h-4 w-4" />
            {editingConfig ? 'Update' : 'Create'}
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
