<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Label } from '$components/ui/label';
  import { Badge } from '$components/ui/badge';
  import { Switch } from '$components/ui/switch';
  import { Textarea } from '$components/ui/textarea';
  import * as Card from '$components/ui/card';
  import * as Dialog from '$components/ui/dialog';
  import { Separator } from '$components/ui/separator';
  import { invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import {
    Bell,
    Edit,
    Save,
    Eye,
    ArrowLeft
  } from 'lucide-svelte';

  interface NotificationTemplate {
    id: string;
    type: string;
    channel: string;
    subject: string | null;
    body_template: string;
    is_active: boolean | null;
    updated_at: string | null;
    created_at: string | null;
  }

  let { data } = $props();

  let editingTemplate = $state<NotificationTemplate | null>(null);
  let isEditing = $state(false);
  let isSaving = $state(false);
  let formBody = $state('');
  let formIsActive = $state(true);

  // Preview variables for testing
  const previewVariables = {
    order_number: 'GB-2026-0001',
    status: 'Shipped',
    previous_status: 'Processing',
    tracking_number: '9400111899223456789012',
    tracking_carrier: 'USPS',
    tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=9400111899223456789012',
    order_url: '/orders/example-id',
    invoice_url: 'https://paypal.com/invoice/example'
  };

  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'order_status_change': 'Order Status Change',
      'tracking_added': 'Tracking Number Added',
      'payment_reminder': 'Payment Reminder'
    };
    return labels[type] || type;
  }

  function getChannelLabel(channel: string): string {
    return channel === 'discord' ? 'Discord DM' : 'Email';
  }

  function interpolatePreview(template: string): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return (previewVariables as Record<string, string>)[key] || match;
    });
  }

  function openEditDialog(template: NotificationTemplate) {
    editingTemplate = template;
    formBody = template.body_template;
    formIsActive = template.is_active ?? true;
    isEditing = true;
  }

  async function handleSubmit() {
    if (!editingTemplate) return;

    isSaving = true;

    try {
      const response = await fetch(`/api/admin/templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body_template: formBody,
          is_active: formIsActive
        })
      });

      if (response.ok) {
        toast.success('Template updated');
        isEditing = false;
        editingTemplate = null;
        invalidateAll();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save template');
      }
    } catch (err) {
      toast.error('Failed to save template');
    } finally {
      isSaving = false;
    }
  }

  async function toggleActive(template: NotificationTemplate) {
    try {
      const response = await fetch(`/api/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !template.is_active })
      });

      if (response.ok) {
        toast.success(template.is_active ? 'Template disabled' : 'Template enabled');
        invalidateAll();
      } else {
        toast.error('Failed to toggle template');
      }
    } catch (err) {
      toast.error('Failed to toggle template');
    }
  }
</script>

<div class="p-8">
  <div class="mb-8">
    <a href="/admin/settings" class="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft class="mr-1 h-4 w-4" />
      Back to Settings
    </a>
    <h1 class="text-3xl font-bold">Notification Templates</h1>
    <p class="text-muted-foreground">Customize the messages sent to users</p>
  </div>

  <!-- Template Variables Reference -->
  <Card.Root class="mb-8">
    <Card.Header>
      <Card.Title class="text-lg">Available Variables</Card.Title>
      <Card.Description>Use these placeholders in your templates</Card.Description>
    </Card.Header>
    <Card.Content>
      <div class="flex flex-wrap gap-2">
        {#each Object.keys(previewVariables) as variable}
          <code class="rounded bg-muted px-2 py-1 text-sm">{`{{${variable}}}`}</code>
        {/each}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Templates List -->
  <div class="grid gap-4">
    {#each data.templates as template (template.id)}
      <Card.Root>
        <Card.Header>
          <div class="flex items-start justify-between">
            <div>
              <Card.Title class="flex items-center gap-2">
                <Bell class="h-5 w-5" />
                {getTypeLabel(template.type)}
              </Card.Title>
              <Card.Description class="flex items-center gap-2 mt-1">
                <Badge variant="outline">{getChannelLabel(template.channel)}</Badge>
                {#if template.is_active}
                  <Badge class="bg-green-500">Active</Badge>
                {:else}
                  <Badge variant="secondary">Disabled</Badge>
                {/if}
              </Card.Description>
            </div>
            <div class="flex gap-2">
              <Button variant="outline" size="sm" onclick={() => openEditDialog(template)}>
                <Edit class="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onclick={() => toggleActive(template)}
              >
                {template.is_active ? 'Disable' : 'Enable'}
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          <div class="grid gap-4 lg:grid-cols-2">
            <!-- Template Source -->
            <div>
              <Label class="mb-2 block text-sm font-medium">Template</Label>
              <pre class="whitespace-pre-wrap rounded bg-muted p-3 text-sm font-mono">{template.body_template}</pre>
            </div>
            <!-- Preview -->
            <div>
              <Label class="mb-2 block text-sm font-medium flex items-center gap-1">
                <Eye class="h-4 w-4" />
                Preview
              </Label>
              <div class="whitespace-pre-wrap rounded border bg-card p-3 text-sm">
                {interpolatePreview(template.body_template)}
              </div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    {:else}
      <Card.Root>
        <Card.Content class="py-8 text-center text-muted-foreground">
          <Bell class="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p>No notification templates found.</p>
          <p class="text-sm">Run database migrations to create default templates.</p>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
</div>

<!-- Edit Template Dialog -->
<Dialog.Root bind:open={isEditing}>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>Edit Template</Dialog.Title>
      <Dialog.Description>
        {editingTemplate ? getTypeLabel(editingTemplate.type) : ''}
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="body">Message Template</Label>
          <Textarea 
            id="body"
            rows={8}
            bind:value={formBody}
            placeholder="Enter your notification message..."
            class="font-mono"
          />
          <p class="text-xs text-muted-foreground">
            Use {'{{variable_name}}'} syntax for dynamic content
          </p>
        </div>

        <Separator />

        <!-- Live Preview -->
        <div class="space-y-2">
          <Label class="flex items-center gap-1">
            <Eye class="h-4 w-4" />
            Live Preview
          </Label>
          <div class="whitespace-pre-wrap rounded border bg-card p-3 text-sm">
            {interpolatePreview(formBody)}
          </div>
        </div>

        <Separator />

        <div class="flex items-center justify-between">
          <div>
            <Label for="is_active">Active</Label>
            <p class="text-xs text-muted-foreground">
              Disabled templates won't be sent
            </p>
          </div>
          <Switch id="is_active" bind:checked={formIsActive} />
        </div>
      </div>

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => isEditing = false}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {#if isSaving}
            Saving...
          {:else}
            <Save class="mr-2 h-4 w-4" />
            Save Template
          {/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
