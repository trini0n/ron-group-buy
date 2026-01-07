<script lang="ts">
  import '../app.css';
  import { ModeWatcher } from 'mode-watcher';
  import { createSupabaseClient } from '$lib/supabase';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import Header from '$components/layout/Header.svelte';
  import Footer from '$components/layout/Footer.svelte';
  import GroupBuyBanner from '$components/layout/GroupBuyBanner.svelte';
  import { Toaster } from '$components/ui/sonner';
  import * as Tooltip from '$components/ui/tooltip';
  import { invalidateAll } from '$app/navigation';
  import { cartStore } from '$lib/stores/cart.svelte';
  import CartMergeModal from '$components/cart/CartMergeModal.svelte';

  let { data, children } = $props();

  // Track if merge modal should be shown
  let showMergeModal = $state(false);

  // Track auth state changes
  onMount(() => {
    // Create browser-side Supabase client only in browser
    const supabase = createSupabaseClient();
    
    // Initial cart sync
    cartStore.syncFromServer();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, _session) => {
      // Only invalidate data on sign in/out, don't reload to avoid loops
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        invalidateAll();
        
        // Handle cart sync on auth change
        if (event === 'SIGNED_IN') {
          // Check for merge after login
          const mergeStatus = await cartStore.checkMergeStatus();
          if (mergeStatus?.merge_needed) {
            if (mergeStatus.requires_confirmation) {
              showMergeModal = true;
            } else {
              // Auto-merge without confirmation
              await cartStore.executeMerge();
            }
          } else {
            // Just sync the cart
            await cartStore.syncFromServer();
          }
        } else if (event === 'SIGNED_OUT') {
          await cartStore.onAuthChange(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  });

  function handleMergeConfirm() {
    cartStore.executeMerge(true);
    showMergeModal = false;
  }

  function handleMergeSkip() {
    cartStore.skipMerge();
    showMergeModal = false;
  }
</script>

<ModeWatcher defaultMode="dark" />
<Toaster />

<Tooltip.Provider>
<div class="flex min-h-screen flex-col">
  <GroupBuyBanner config={data.groupBuyConfig} />
  <Header user={data.user} isAdmin={data.isAdmin} />
  
  <main class="flex-1">
    {@render children()}
  </main>
  
  {#if !data.url?.pathname?.startsWith('/admin')}
    <Footer />
  {/if}
</div>
</Tooltip.Provider>

<!-- Cart Merge Modal -->
<CartMergeModal
  open={showMergeModal}
  mergeStatus={cartStore.pendingMerge}
  onConfirm={handleMergeConfirm}
  onSkip={handleMergeSkip}
/>
