<script lang="ts">
  import '../app.css';
  import { ModeWatcher } from 'mode-watcher';
  import { createSupabaseClient } from '$lib/supabase';
  import { onMount } from 'svelte';
  import Header from '$components/layout/Header.svelte';
  import Footer from '$components/layout/Footer.svelte';
  import GroupBuyBanner from '$components/layout/GroupBuyBanner.svelte';
  import { Toaster } from '$components/ui/sonner';
  import * as Tooltip from '$components/ui/tooltip';
  import { invalidateAll } from '$app/navigation';

  let { data, children } = $props();

  // Create browser-side Supabase client
  const supabase = createSupabaseClient();

  // Track auth state changes
  onMount(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, _session) => {
      // Only invalidate data on sign in/out, don't reload to avoid loops
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        invalidateAll();
      }
    });

    return () => subscription.unsubscribe();
  });
</script>

<ModeWatcher defaultMode="dark" />
<Toaster />

<Tooltip.Provider>
<div class="flex min-h-screen flex-col">
  <GroupBuyBanner config={data.groupBuyConfig} />
  <Header user={data.user} />
  
  <main class="flex-1">
    {@render children()}
  </main>
  
  <Footer />
</div>
</Tooltip.Provider>
