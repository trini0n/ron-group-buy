<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import * as Card from '$components/ui/card';
  import { createSupabaseClient } from '$lib/supabase';
  import { ArrowLeft, Check, Mail } from 'lucide-svelte';

  const supabase = createSupabaseClient();

  let email = $state('');
  let isLoading = $state(false);
  let error = $state('');
  let success = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isLoading = true;
    error = '';

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });

    if (authError) {
      error = authError.message;
      isLoading = false;
    } else {
      success = true;
    }
  }
</script>

<svelte:head>
  <title>Forgot Password - Group Buy</title>
</svelte:head>

<div class="container flex min-h-[80vh] items-center justify-center py-8">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">Forgot Password</Card.Title>
      <Card.Description>Enter your email to receive a reset link</Card.Description>
    </Card.Header>

    <Card.Content class="space-y-6">
      {#if success}
        <div class="space-y-4 text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Mail class="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 class="text-lg font-medium">Check your email</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              We sent a password reset link to <strong>{email}</strong>
            </p>
            <p class="mt-2 text-sm text-muted-foreground">
              If you don't see it, check your spam folder.
            </p>
          </div>
          <Button variant="outline" href="/auth/login" class="mt-4">
            <ArrowLeft class="mr-2 h-4 w-4" />
            Back to Sign In
          </Button>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="space-y-4">
          {#if error}
            <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          {/if}

          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              bind:value={email}
              required
            />
          </div>

          <Button type="submit" class="w-full" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
      {/if}
    </Card.Content>

    {#if !success}
      <Card.Footer class="justify-center">
        <a href="/auth/login" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft class="mr-2 h-4 w-4" />
          Back to Sign In
        </a>
      </Card.Footer>
    {/if}
  </Card.Root>
</div>
