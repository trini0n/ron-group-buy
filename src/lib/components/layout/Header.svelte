<script lang="ts">
  import * as DropdownMenu from '$components/ui/dropdown-menu';
  import { Button } from '$components/ui/button';
  import { createSupabaseClient } from '$lib/supabase';
  import { ShoppingCart, User, Menu, Sun, Moon, LogOut } from 'lucide-svelte';
  import { toggleMode, mode } from 'mode-watcher';
  import { cartStore } from '$lib/stores/cart.svelte';
  import type { User as SupabaseUser } from '@supabase/supabase-js';

  interface Props {
    user: SupabaseUser | null;
  }

  let { user }: Props = $props();
  const supabase = createSupabaseClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }

  async function signInWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div class="container flex h-16 items-center justify-between">
    <!-- Logo -->
    <a href="/" class="flex items-center gap-2 text-xl font-bold">
      <span class="text-2xl">🃏</span>
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
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <Button variant="outline">Sign In</Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content class="w-48" sideOffset={4}>
            <DropdownMenu.Item onSelect={signInWithGoogle}>
              <svg class="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={signInWithDiscord}>
              <svg class="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
              </svg>
              Continue with Discord
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
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
