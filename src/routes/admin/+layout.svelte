<script lang="ts">
  import * as Sidebar from '$components/ui/sidebar';
  import { 
    LayoutDashboard, 
    ShoppingCart, 
    Users, 
    Package, 
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

<div class="h-[calc(100vh-4rem)]" style="--sidebar-height: calc(100vh - 4rem);">
  <Sidebar.Provider class="!min-h-[var(--sidebar-height)]">
    <Sidebar.Root collapsible="icon" class="z-40 !h-[var(--sidebar-height)] top-16">
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupContent>
            <Sidebar.Menu><bos>
              {#each navItems as item}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton isActive={isActive(item.href)} tooltip={item.label}>
                    {#snippet child({ props })}
                      <a href={item.href} {...props}>
                        <item.icon />
                        <span>{item.label}</span>
                      </a>
                    {/snippet}
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              {/each}
            </Sidebar.Menu>
          </Sidebar.GroupContent>
        </Sidebar.Group>
      </Sidebar.Content>

      <Sidebar.Footer>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <div class="flex flex-col gap-0.5 px-2 py-1.5 text-left text-sm">
              <span class="text-xs text-sidebar-foreground/70">Logged in as</span>
              <span class="truncate font-medium">{data.admin.name || data.admin.email}</span>
            </div>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Footer>

      <Sidebar.Rail />
    </Sidebar.Root>

    <Sidebar.Inset>
      <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Sidebar.Trigger class="-ml-1" />
        <span class="text-sm text-muted-foreground">Admin</span>
      </header>
      <main class="flex-1 overflow-auto">
        {@render children()}
      </main>
    </Sidebar.Inset>
  </Sidebar.Provider>
</div>
