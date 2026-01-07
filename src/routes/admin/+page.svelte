<script lang="ts">
  import * as Card from '$components/ui/card';
  import { Badge } from '$components/ui/badge';
  import { ORDER_STATUS_CONFIG } from '$lib/admin-shared';
  import { 
    ShoppingCart, 
    Users, 
    Package, 
    AlertTriangle,
    TrendingUp
  } from 'lucide-svelte';

  let { data } = $props();

  const stats = $derived(data.stats);
  const activeOrders = $derived(stats.ordersByStatus.pending + 
                       stats.ordersByStatus.invoiced + 
                       stats.ordersByStatus.paid + 
                       stats.ordersByStatus.processing);
</script>

<div class="p-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold">Dashboard</h1>
    <p class="text-muted-foreground">Overview of your group buy operations</p>
  </div>

  <!-- Stats Grid -->
  <div class="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-sm font-medium">Total Orders</Card.Title>
        <ShoppingCart class="h-4 w-4 text-muted-foreground" />
      </Card.Header>
      <Card.Content>
        <div class="text-2xl font-bold">{stats.totalOrders}</div>
        <p class="text-xs text-muted-foreground">
          {activeOrders} active
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-sm font-medium">Registered Users</Card.Title>
        <Users class="h-4 w-4 text-muted-foreground" />
      </Card.Header>
      <Card.Content>
        <div class="text-2xl font-bold">{stats.totalUsers}</div>
        <p class="text-xs text-muted-foreground">
          Total accounts
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-sm font-medium">Card Catalog</Card.Title>
        <Package class="h-4 w-4 text-muted-foreground" />
      </Card.Header>
      <Card.Content>
        <div class="text-2xl font-bold">{stats.totalCards}</div>
        <p class="text-xs text-muted-foreground">
          Total listings
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-sm font-medium">Out of Stock</Card.Title>
        <AlertTriangle class="h-4 w-4 text-muted-foreground" />
      </Card.Header>
      <Card.Content>
        <div class="text-2xl font-bold">{stats.outOfStockCards}</div>
        <p class="text-xs text-muted-foreground">
          Cards unavailable
        </p>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Orders by Status -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Orders by Status</Card.Title>
      <Card.Description>Current distribution of order statuses</Card.Description>
    </Card.Header>
    <Card.Content>
      <div class="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {#each Object.entries(ORDER_STATUS_CONFIG) as [status, config]}
          {@const count = stats.ordersByStatus[status as keyof typeof stats.ordersByStatus] || 0}
          <a 
            href="/admin/orders?status={status}"
            class="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted"
          >
            <div>
              <Badge class={config.color}>{config.label}</Badge>
              <p class="mt-1 text-xs text-muted-foreground">{config.description}</p>
            </div>
            <span class="text-2xl font-bold">{count}</span>
          </a>
        {/each}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Quick Actions -->
  <div class="mt-8 grid gap-4 md:grid-cols-3">
    <a href="/admin/orders?status=pending" class="block">
      <Card.Root class="transition-colors hover:bg-muted">
        <Card.Header>
          <Card.Title class="text-lg">Pending Orders</Card.Title>
          <Card.Description>Orders awaiting invoice</Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-3xl font-bold">{stats.ordersByStatus.pending}</p>
        </Card.Content>
      </Card.Root>
    </a>

    <a href="/admin/orders?status=paid" class="block">
      <Card.Root class="transition-colors hover:bg-muted">
        <Card.Header>
          <Card.Title class="text-lg">Paid Orders</Card.Title>
          <Card.Description>Ready to process</Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-3xl font-bold">{stats.ordersByStatus.paid}</p>
        </Card.Content>
      </Card.Root>
    </a>

    <a href="/admin/inventory?stock=out" class="block">
      <Card.Root class="transition-colors hover:bg-muted">
        <Card.Header>
          <Card.Title class="text-lg">Out of Stock</Card.Title>
          <Card.Description>Cards needing restock</Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-3xl font-bold">{stats.outOfStockCards}</p>
        </Card.Content>
      </Card.Root>
    </a>
  </div>
</div>
