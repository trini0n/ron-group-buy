<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import { Textarea } from '$components/ui/textarea';
  import { Badge } from '$components/ui/badge';
  import * as Card from '$components/ui/card';
  import * as Table from '$components/ui/table';
  import * as Select from '$components/ui/select';
  import * as Dialog from '$components/ui/dialog';
  import * as AlertDialog from '$components/ui/alert-dialog';
  import * as Tooltip from '$components/ui/tooltip';
  import { Separator } from '$components/ui/separator';
  import { getCardImageUrl, getFinishLabel, getFinishBadgeClasses, getFrameEffectLabel, getTrackingUrl } from '$lib/utils';
  import { 
    ORDER_STATUS_CONFIG, 
    getNextStatuses, 
    type OrderStatus 
  } from '$lib/admin-shared';
  import { 
    ArrowLeft, 
    Save, 
    Package, 
    User, 
    MapPin, 
    Clock,
    ExternalLink,
    Truck,
    Trash2
  } from 'lucide-svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { toast } from 'svelte-sonner';

  let { data } = $props();

  const order = $derived(data.order);
  const statusConfig = $derived(ORDER_STATUS_CONFIG[order.status as OrderStatus]);
  const nextStatuses = $derived(getNextStatuses(order.status as OrderStatus));

  // Editable fields
  let trackingNumber = $state('');
  let trackingCarrier = $state('');
  let adminNotes = $state('');
  let paypalInvoiceUrl = $state('');
  
  $effect(() => {
    trackingNumber = data.order.tracking_number || '';
    trackingCarrier = data.order.tracking_carrier || '';
    adminNotes = data.order.admin_notes || '';
    paypalInvoiceUrl = data.order.paypal_invoice_url || '';
  });
  
  // Status change dialog
  let statusDialogOpen = $state(false);
  let newStatus = $state<OrderStatus | ''>('');
  let statusChangeNotes = $state('');
  
  // Delete confirmation dialog
  let deleteDialogOpen = $state(false);
  let isDeleting = $state(false);

  let isSaving = $state(false);
  let isChangingStatus = $state(false);

  function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatPrice(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Shipping pricing constants (same as checkout)
  const SHIPPING_RATES = {
    us: { regular: 6.00, express: 40.00, tariff: 9.00 },
    international: { regular: 6.00, express: 25.00, tariff: 0 }
  };

  // Calculate shipping costs based on order data
  const isUSShipping = $derived(
    order.shipping_country?.toUpperCase() === 'US' ||
    order.shipping_country?.toUpperCase() === 'USA' ||
    order.shipping_country?.toUpperCase() === 'UNITED STATES'
  );
  const rates = $derived(isUSShipping ? SHIPPING_RATES.us : SHIPPING_RATES.international);
  const shippingCost = $derived(order.shipping_type === 'express' ? rates.express : rates.regular);
  const tariffCost = $derived(rates.tariff);
  const grandTotal = $derived(order.subtotal + shippingCost + tariffCost);

  async function saveOrderDetails() {
    isSaving = true;
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_number: trackingNumber || null,
          tracking_carrier: trackingCarrier || null,
          admin_notes: adminNotes || null,
          paypal_invoice_url: paypalInvoiceUrl || null
        })
      });

      if (response.ok) {
        toast.success('Order updated successfully');
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to update order');
      }
    } catch (err) {
      toast.error('Failed to update order');
    } finally {
      isSaving = false;
    }
  }

  async function changeStatus() {
    if (!newStatus) return;
    
    isChangingStatus = true;
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: statusChangeNotes || null
        })
      });

      if (response.ok) {
        toast.success(`Status changed to ${ORDER_STATUS_CONFIG[newStatus]?.label}`);
        statusDialogOpen = false;
        newStatus = '';
        statusChangeNotes = '';
        invalidateAll();
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to change status');
      }
    } catch (err) {
      toast.error('Failed to change status');
    } finally {
      isChangingStatus = false;
    }
  }

  async function deleteOrder() {
    isDeleting = true;
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Order deleted successfully');
        goto('/admin/orders');
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to delete order');
        deleteDialogOpen = false;
      }
    } catch (err) {
      toast.error('Failed to delete order');
      deleteDialogOpen = false;
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="p-8">
  <!-- Header -->
  <div class="mb-6 flex items-center gap-4">
    <Button variant="ghost" size="icon" href="/admin/orders">
      <ArrowLeft class="h-4 w-4" />
    </Button>
    <div class="flex-1">
      <h1 class="text-2xl font-bold">Order {order.order_number}</h1>
      <p class="text-sm text-muted-foreground">
        Placed on {formatDate(order.created_at)}
      </p>
    </div>
    <Badge class="{statusConfig?.color} text-lg px-4 py-1">
      {statusConfig?.label || order.status}
    </Badge>
    <Button variant="destructive" size="sm" onclick={() => deleteDialogOpen = true}>
      <Trash2 class="h-4 w-4 mr-2" />
      Delete Order
    </Button>
  </div>

  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Main Content -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Order Items -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <Package class="h-5 w-5" />
            Order Items ({order.itemCount})
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Card</Table.Head>
                <Table.Head>Serial</Table.Head>
                <Table.Head>Type</Table.Head>
                <Table.Head class="text-right">Qty</Table.Head>
                <Table.Head class="text-right">Price</Table.Head>
                <Table.Head class="text-right">Total</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each order.items as item}
                {@const frameEffect = getFrameEffectLabel(item.card)}
                {@const finishLabel = getFinishLabel(item.card || { card_type: item.card_type })}
                <Table.Row>
                  <Table.Cell>
                    <Tooltip.Root delayDuration={100}>
                      <Tooltip.Trigger>
                        <span class="font-medium cursor-pointer hover:underline">{item.card_name}</span>
                      </Tooltip.Trigger>
                      <Tooltip.Content class="w-auto p-1 bg-transparent border-0 shadow-none" side="right">
                        <img 
                          src={getCardImageUrl(item.card?.ron_image_url ?? null, item.card?.scryfall_id ?? null, 'normal')}
                          alt={item.card_name}
                          class="w-48 rounded-lg shadow-xl"
                        />
                      </Tooltip.Content>
                    </Tooltip.Root>
                    <p class="text-xs text-muted-foreground">
                      {item.card?.set_code?.toUpperCase() || '???'} #{item.card?.collector_number || '?'}
                      {#if frameEffect}
                        • {frameEffect}
                      {/if}
                    </p>
                  </Table.Cell>
                  <Table.Cell class="font-mono text-sm">{item.card_serial}</Table.Cell>
                  <Table.Cell>
                    <Badge class={getFinishBadgeClasses(finishLabel)}>{finishLabel}</Badge>
                  </Table.Cell>
                  <Table.Cell class="text-right">{item.quantity}</Table.Cell>
                  <Table.Cell class="text-right">{formatPrice(Number(item.unit_price))}</Table.Cell>
                  <Table.Cell class="text-right font-medium">
                    {formatPrice((item.quantity ?? 0) * Number(item.unit_price))}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
          <Separator class="my-4" />
          <div class="flex justify-end">
            <div class="w-64 space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Subtotal ({order.itemCount} cards)</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Shipping ({order.shipping_type === 'express' ? 'Express' : 'Regular'})</span>
                <span>{formatPrice(shippingCost)}</span>
              </div>
              {#if tariffCost > 0}
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">Tariff (US)</span>
                  <span>{formatPrice(tariffCost)}</span>
                </div>
              {/if}
              <Separator class="my-2" />
              <div class="flex justify-between font-bold">
                <span>Total</span>
                <span class="text-lg">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Status History -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <Clock class="h-5 w-5" />
            Status History
          </Card.Title>
        </Card.Header>
        <Card.Content>
          {#if data.statusHistory.length > 0}
            <div class="space-y-4">
              {#each data.statusHistory as entry}
                <div class="flex items-start gap-4 border-l-2 border-muted pl-4">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      {#if entry.old_status}
                        <Badge variant="outline" class="text-xs">
                          {ORDER_STATUS_CONFIG[entry.old_status as OrderStatus]?.label}
                        </Badge>
                        <span class="text-muted-foreground">→</span>
                      {/if}
                      <Badge class={ORDER_STATUS_CONFIG[entry.new_status as OrderStatus]?.color}>
                        {ORDER_STATUS_CONFIG[entry.new_status as OrderStatus]?.label}
                      </Badge>
                    </div>
                    {#if entry.notes}
                      <p class="mt-1 text-sm text-muted-foreground">{entry.notes}</p>
                    {/if}
                    <p class="mt-1 text-xs text-muted-foreground">
                      {formatDate(entry.created_at)}
                      {#if entry.changed_by_user}
                        by {entry.changed_by_user.name || entry.changed_by_user.email}
                      {/if}
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-sm text-muted-foreground">No status changes recorded</p>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Status Actions -->
      <Card.Root>
        <Card.Header>
          <Card.Title>Status Actions</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-3">
          {#if nextStatuses.length > 0}
            {#each nextStatuses as status}
              {@const config = ORDER_STATUS_CONFIG[status]}
              <Button 
                variant="outline" 
                class="w-full justify-start"
                onclick={() => { newStatus = status; statusDialogOpen = true; }}
              >
                <Badge class="{config.color} mr-2">{config.label}</Badge>
                Mark as {config.label}
              </Button>
            {/each}
          {:else}
            <p class="text-sm text-muted-foreground">No status changes available</p>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Customer Info -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <User class="h-5 w-5" />
            Customer
          </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-2">
          <p class="font-medium">{order.user?.name || 'Unknown'}</p>
          <p class="text-sm text-muted-foreground">{order.user?.email}</p>
          {#if order.user?.paypal_email && order.user.paypal_email !== order.user.email}
            <p class="text-sm text-muted-foreground">PayPal: {order.user.paypal_email}</p>
          {:else}
            <p class="text-sm text-muted-foreground">PayPal: {order.user?.email}</p>
          {/if}
          {#if order.user?.discord_username}
            <p class="text-sm text-muted-foreground">Discord: {order.user.discord_username}</p>
          {/if}
          <Button variant="outline" size="sm" href="/admin/users/{order.user?.id}" class="mt-2">
            View User Profile
          </Button>
        </Card.Content>
      </Card.Root>

      <!-- Shipping Address -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <MapPin class="h-5 w-5" />
            Shipping Address
          </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-3">
          <div class="flex items-center gap-2 text-sm">
            {#if order.shipping_type === 'express'}
              <Truck class="h-4 w-4" />
              <Badge variant="outline">Express Shipping</Badge>
            {:else}
              <Package class="h-4 w-4" />
              <Badge variant="outline">Regular Shipping</Badge>
            {/if}
          </div>
          <address class="not-italic text-sm">
            <p class="font-medium">{order.shipping_name}</p>
            <p>{order.shipping_line1}</p>
            {#if order.shipping_line2}
              <p>{order.shipping_line2}</p>
            {/if}
            <p>{order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}</p>
            <p>{order.shipping_country}</p>
          </address>
        </Card.Content>
      </Card.Root>

      <!-- Tracking & Invoice -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <Truck class="h-5 w-5" />
            Tracking & Invoice
          </Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="space-y-2">
            <Label for="tracking">Tracking Number</Label>
            <Input 
              id="tracking" 
              placeholder="Enter tracking number"
              bind:value={trackingNumber}
            />
          </div>
          <div class="space-y-2">
            <Label for="carrier">Carrier</Label>
            <Input 
              id="carrier" 
              placeholder="USPS, UPS, FedEx, etc."
              bind:value={trackingCarrier}
            />
          </div>
          {#if trackingNumber}
            <a 
              href={getTrackingUrl(trackingNumber)} 
              target="_blank"
              class="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              Track on 17track.net
              <ExternalLink class="h-3 w-3" />
            </a>
          {/if}
          <Separator />
          <div class="space-y-2">
            <Label for="paypal">PayPal Invoice URL</Label>
            <Input 
              id="paypal" 
              placeholder="https://paypal.com/invoice/..."
              bind:value={paypalInvoiceUrl}
            />
          </div>
          {#if paypalInvoiceUrl}
            <a 
              href={paypalInvoiceUrl} 
              target="_blank"
              class="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              View Invoice
              <ExternalLink class="h-3 w-3" />
            </a>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Admin Notes -->
      <Card.Root>
        <Card.Header>
          <Card.Title>Admin Notes</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <Textarea 
            placeholder="Internal notes about this order..."
            rows={4}
            bind:value={adminNotes}
          />
          <Button onclick={saveOrderDetails} disabled={isSaving} class="w-full">
            <Save class="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>

<!-- Status Change Dialog -->
<Dialog.Root bind:open={statusDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Change Order Status</Dialog.Title>
      <Dialog.Description>
        Change order {order.order_number} to 
        {newStatus ? ORDER_STATUS_CONFIG[newStatus]?.label : ''}
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label for="status-notes">Notes (optional)</Label>
        <Textarea
          id="status-notes"
          placeholder="Add notes about this status change..."
          bind:value={statusChangeNotes}
        />
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => statusDialogOpen = false}>
        Cancel
      </Button>
      <Button onclick={changeStatus} disabled={isChangingStatus}>
        {isChangingStatus ? 'Updating...' : 'Confirm Change'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Order Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Order</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to delete order <strong>{order.order_number}</strong>? 
        This will permanently remove the order and all its items from the database. 
        This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action 
        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onclick={deleteOrder}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting...' : 'Delete Order'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
