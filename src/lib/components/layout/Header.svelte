<script lang="ts">
  import * as DropdownMenu from '$components/ui/dropdown-menu';
  import { Button } from '$components/ui/button';
  import { ShoppingCart, User, Menu, Sun, Moon, LogOut } from 'lucide-svelte';
  import { toggleMode, mode } from 'mode-watcher';
  import { cartStore } from '$lib/stores/cart.svelte';
  import type { User as SupabaseUser } from '@supabase/supabase-js';

  interface Props {
    user: SupabaseUser | null;
  }

  let { user }: Props = $props();
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div class="container flex h-16 items-center justify-between">
    <!-- Logo -->
    <a href="/" class="flex items-center gap-2 text-xl font-bold">
      <img src="/favicon.webp" alt="Logo" class="h-7 w-7" />
      Group Buy
    </a>

    <!-- Navigation -->
    <nav class="hidden items-center gap-6 md:flex">
      <a href="/" class="text-sm font-medium transition-colors hover:text-primary">
        Cards
      </a>
      <a href="/deck-import" class="text-sm font-medium transition-colors hover:text-primary">
        Deck Import
      </a>
      {#if user}
        <a href="/orders" class="text-sm font-medium transition-colors hover:text-primary">
          Orders
        </a>
      {/if}
    </nav>

    <!-- Right side actions -->
    <div class="flex items-center gap-2">
      <!-- Theme toggle -->
      <Button variant="ghost" size="icon" onclick={toggleMode}>
        {#if mode.current === 'dark'}
          <Sun class="h-5 w-5" />
        {:else}
          <Moon class="h-5 w-5" />
        {/if}
      </Button>

      <!-- Cart button -->
      <a href="/cart" class="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
        <ShoppingCart class="h-5 w-5" />
        {#if cartStore.itemCount > 0}
          <span class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {cartStore.itemCount}
          </span>
        {/if}
      </a>

      <!-- User menu -->
      {#if user}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger class="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent">
            {#if user.user_metadata?.avatar_url}
              <img 
                src={user.user_metadata.avatar_url} 
                alt="Avatar" 
                class="h-8 w-8 rounded-full"
              />
            {:else}
              <User class="h-5 w-5" />
            {/if}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content class="w-48" sideOffset={4}>
            <DropdownMenu.Label>{user.email}</DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>
              <a href="/account" class="flex w-full items-center">Account</a>
            </DropdownMenu.Item>
            <DropdownMenu.Item>
              <a href="/orders" class="flex w-full items-center">Order History</a>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>
              <a href="/auth/logout" class="flex w-full items-center gap-2">
                <LogOut class="h-4 w-4" />
                Sign out
              </a>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      {:else}
        <Button variant="outline" href="/auth/login">Sign In</Button>
      {/if}

      <!-- Mobile menu -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent md:hidden">
          <Menu class="h-5 w-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content sideOffset={4}>
          <DropdownMenu.Item>
            <a href="/" class="flex w-full items-center">Cards</a>
          </DropdownMenu.Item>
          <DropdownMenu.Item>
            <a href="/deck-import" class="flex w-full items-center">Deck Import</a>
          </DropdownMenu.Item>
          {#if user}
            <DropdownMenu.Item>
              <a href="/orders" class="flex w-full items-center">Orders</a>
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>
</header>
