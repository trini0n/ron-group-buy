<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Separator } from '$components/ui/separator';
  import { 
    LayoutDashboard, 
    ShoppingCart, 
    Users, 
    Package, 
    ArrowLeft,
    Settings
  } from 'lucide-svelte';
  import { page } from '$app/stores';

  let { data, children } = $props();

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/inventory', label: 'Inventory', icon: Package },
    { href: '/admin/settings', label: 'Settings', icon: Settings }
  ];

  function isActive(href: string): boolean {
    if (href === '/admin') {
      return $page.url.pathname === '/admin';
    }
    return $page.url.pathname.startsWith(href);
  }
</script>

<svelte:head>
  <title>Admin - Group Buy</title>
</svelte:head>

<div class="flex min-h-screen">
  <!-- Sidebar -->
  <aside class="w-64 border-r bg-muted/30">
    <div class="flex h-16 items-center gap-2 border-b px-6">
      <a href="/" class="text-muted-foreground hover:text-foreground">
        <ArrowLeft class="h-4 w-4" />
      </a>
      <span class="font-semibold">Admin Panel</span>
    </div>

    <nav class="space-y-1 p-4">
      {#each navItems as item}
        <a
          href={item.href}
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
            {isActive(item.href) 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
        >
          <item.icon class="h-4 w-4" />
          {item.label}
        </a>
      {/each}
    </nav>

    <Separator class="my-4" />

    <div class="px-4">
      <p class="px-3 text-xs text-muted-foreground">Logged in as</p>
      <p class="truncate px-3 text-sm font-medium">{data.admin.name || data.admin.email}</p>
    </div>
  </aside>

  <!-- Main content -->
  <main class="flex-1 overflow-auto">
    {@render children()}
  </main>
</div>
