<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import * as Card from '$components/ui/card';
  import { createSupabaseClient } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Check, X, Info } from 'lucide-svelte';

  const supabase = createSupabaseClient();

  let password = $state('');
  let confirmPassword = $state('');
  let isLoading = $state(false);
  let error = $state('');
  let success = $state(false);
  let hasValidSession = $state(false);
  let isCheckingSession = $state(true);

  // Password validation (same as signup)
  const passwordLength = $derived(password.length);
  const isMinLength = $derived(passwordLength >= 8);
  const isRecommendedLength = $derived(passwordLength >= 12);
  const passwordsMatch = $derived(password === confirmPassword && confirmPassword.length > 0);
  const isPasswordValid = $derived(isMinLength && passwordsMatch);

  onMount(async () => {
    // Check if we have a valid session from the reset link
    // Supabase automatically handles the token from the URL hash
    const { data: { session } } = await supabase.auth.getSession();
    hasValidSession = !!session;
    isCheckingSession = false;
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!isPasswordValid) {
      error = 'Please fix the password issues above';
      return;
    }

    isLoading = true;
    error = '';

    const { error: authError } = await supabase.auth.updateUser({
      password
    });

    if (authError) {
      error = authError.message;
      isLoading = false;
    } else {
      success = true;
      // Redirect after a short delay
      setTimeout(() => {
        goto('/');
      }, 2000);
    }
  }
</script>

<svelte:head>
  <title>Reset Password - Group Buy</title>
</svelte:head>

<div class="container flex min-h-[80vh] items-center justify-center py-8">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">Reset Password</Card.Title>
      <Card.Description>Enter your new password</Card.Description>
    </Card.Header>

    <Card.Content class="space-y-6">
      {#if isCheckingSession}
        <div class="flex items-center justify-center py-8">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      {:else if !hasValidSession}
        <div class="space-y-4 text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <X class="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 class="text-lg font-medium">Invalid or Expired Link</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              This password reset link is invalid or has expired.
            </p>
          </div>
          <Button href="/auth/forgot-password">
            Request New Link
          </Button>
        </div>
      {:else if success}
        <div class="space-y-4 text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Check class="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 class="text-lg font-medium">Password Updated!</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              Your password has been changed successfully.
            </p>
            <p class="mt-2 text-sm text-muted-foreground">
              Redirecting you home...
            </p>
          </div>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="space-y-4">
          {#if error}
            <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          {/if}

          <div class="space-y-2">
            <Label for="password">New Password</Label>
            <Input
              id="password"
              type="password"
              bind:value={password}
              required
              minlength="8"
            />
            
            <!-- Password Requirements -->
            <div class="space-y-1 text-sm">
              <div class="flex items-center gap-2">
                {#if isMinLength}
                  <Check class="h-4 w-4 text-green-500" />
                {:else}
                  <X class="h-4 w-4 text-muted-foreground" />
                {/if}
                <span class:text-green-500={isMinLength} class:text-muted-foreground={!isMinLength}>
                  At least 8 characters
                </span>
              </div>
              <div class="flex items-center gap-2">
                {#if isRecommendedLength}
                  <Check class="h-4 w-4 text-green-500" />
                {:else}
                  <Info class="h-4 w-4 text-blue-500" />
                {/if}
                <span class:text-green-500={isRecommendedLength} class:text-blue-500={!isRecommendedLength}>
                  12+ characters recommended
                </span>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              required
            />
            {#if confirmPassword.length > 0}
              <div class="flex items-center gap-2 text-sm">
                {#if passwordsMatch}
                  <Check class="h-4 w-4 text-green-500" />
                  <span class="text-green-500">Passwords match</span>
                {:else}
                  <X class="h-4 w-4 text-destructive" />
                  <span class="text-destructive">Passwords don't match</span>
                {/if}
              </div>
            {/if}
          </div>

          <Button type="submit" class="w-full" disabled={isLoading || !isPasswordValid}>
            {isLoading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
