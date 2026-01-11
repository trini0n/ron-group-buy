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

<div class="h-screen" style="--sidebar-height: 100vh;">
  <Sidebar.Provider class="!min-h-screen">
    <Sidebar.Root collapsible="icon" class="z-40 !h-screen !top-0">
      <Sidebar.Header>
        <div class="h-12 flex items-center border-b px-2 w-full">
          <Sidebar.Menu class="w-full">
            <Sidebar.MenuItem>
              <Sidebar.MenuButton isActive={$page.url.pathname === '/'}>
                {#snippet child({ props })}
                  <a href="/" {...props}>
                    <img 
                      src="https://cdn.discordapp.com/icons/1210417854940446720/345fdba1b79e7462e959124bb8cbe784.webp?size=80&quality=lossless" 
                      alt="Home"
                      class="h-4 w-4 rounded"
                    />
                    <span>Home</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </div>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupContent>
            <Sidebar.Menu>
              {#each navItems as item}
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton isActive={isActive(item.href)}>
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
