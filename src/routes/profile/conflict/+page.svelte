<script lang="ts">
  import { Button } from '$components/ui/button';
  import * as Card from '$components/ui/card';
  import { Badge } from '$components/ui/badge';
  import { Separator } from '$components/ui/separator';
  import { AlertTriangle, ArrowRight, GitMerge, LogOut, User } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { createSupabaseClient } from '$lib/supabase';

  let { data } = $props();

  const supabase = createSupabaseClient();

  let isLoading = $state(false);

  // Determine display text based on conflict type
  const conflictTitle = $derived(
    data.conflictType === 'IDENTITY_ALREADY_LINKED'
      ? `${data.provider === 'google' ? 'Google' : 'Discord'} Account Already Linked`
      : 'Email Already In Use'
  );

  const conflictDescription = $derived(
    data.conflictType === 'IDENTITY_ALREADY_LINKED'
      ? `This ${data.provider === 'google' ? 'Google' : 'Discord'} account is already linked to a different account.`
      : `The email ${data.conflictingUser.email} is already associated with a different account.`
  );

  async function switchToConflictingAccount() {
    isLoading = true;
    // Sign out current user and redirect to login
    await supabase.auth.signOut();
    goto('/auth/login?next=' + encodeURIComponent(data.returnTo));
  }

  function startMerge() {
    // Redirect to merge flow (to be implemented)
    goto(`/account/merge?targetUserId=${data.conflictingUser.id}&returnTo=${encodeURIComponent(data.returnTo)}`);
  }

  function goBack() {
    goto(data.returnTo);
  }
</script>

<svelte:head>
  <title>Account Conflict - Group Buy</title>
</svelte:head>

<div class="flex min-h-svh items-center justify-center p-6">
  <Card.Root class="w-full max-w-lg">
    <Card.Header class="text-center">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
        <AlertTriangle class="h-6 w-6 text-amber-500" />
      </div>
      <Card.Title class="text-xl">{conflictTitle}</Card.Title>
      <Card.Description>{conflictDescription}</Card.Description>
    </Card.Header>

    <Card.Content class="space-y-6">
      <!-- Account Comparison -->
      <div class="grid gap-4 sm:grid-cols-2">
        <!-- Current Account -->
        <div class="rounded-lg border p-4">
          <div class="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User class="h-4 w-4" />
            Your Current Account
          </div>
          <p class="font-medium">{data.currentUser.name || data.currentUser.discordUsername || 'Anonymous'}</p>
          <p class="text-sm text-muted-foreground">{data.currentUser.email}</p>
          <Badge variant="outline" class="mt-2">Signed in</Badge>
        </div>

        <!-- Conflicting Account -->
        <div class="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
          <div class="mb-2 flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle class="h-4 w-4" />
            Conflicting Account
          </div>
          <p class="font-medium">{data.conflictingUser.name || data.conflictingUser.discordUsername || 'Anonymous'}</p>
          <p class="text-sm text-muted-foreground">{data.conflictingUser.email}</p>
          <div class="mt-2 flex flex-wrap gap-1">
            {#if data.conflictingUser.authMethods.hasGoogle}
              <Badge variant="outline" class="text-xs">Google</Badge>
            {/if}
            {#if data.conflictingUser.authMethods.hasDiscord}
              <Badge variant="outline" class="text-xs">Discord</Badge>
            {/if}
          </div>
        </div>
      </div>

      <Separator />

      <!-- Actions -->
      <div class="space-y-3">
        <p class="text-sm font-medium">What would you like to do?</p>

        <Button 
          variant="outline" 
          class="w-full justify-start" 
          onclick={switchToConflictingAccount}
          disabled={isLoading}
        >
          <LogOut class="mr-2 h-4 w-4" />
          Switch to that account
          <ArrowRight class="ml-auto h-4 w-4" />
        </Button>

        <Button 
          variant="default" 
          class="w-full justify-start" 
          onclick={startMerge}
          disabled={isLoading}
        >
          <GitMerge class="mr-2 h-4 w-4" />
          Merge accounts into one
          <ArrowRight class="ml-auto h-4 w-4" />
        </Button>
      </div>

      <div class="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        <strong>About merging:</strong> Merging will combine all orders, addresses, and data from both accounts into your current account. You'll need to verify ownership of both accounts.
      </div>
    </Card.Content>

    <Card.Footer>
      <Button variant="ghost" class="w-full" onclick={goBack}>
        Cancel and go back
      </Button>
    </Card.Footer>
  </Card.Root>
</div>
