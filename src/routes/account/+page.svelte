<script lang="ts">
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Label } from '$components/ui/label';
  import * as Card from '$components/ui/card';
  import { Badge } from '$components/ui/badge';
  import { User, MapPin, Package, Link2, Check, Key, X, Info, Unlink } from 'lucide-svelte';
  import { createSupabaseClient } from '$lib/supabase';

  let { data } = $props();
  
  const supabase = createSupabaseClient();
  
  // Check which providers are linked
  const hasGoogle = $derived(data.linkedProviders.includes('google'));
  const hasDiscord = $derived(data.linkedProviders.includes('discord'));
  const hasEmail = $derived(data.linkedProviders.includes('email'));

  // Count login methods to prevent unlinking the last one
  const loginMethodCount = $derived(
    (hasGoogle ? 1 : 0) + (hasDiscord ? 1 : 0) + (hasEmail ? 1 : 0)
  );
  const canUnlinkOAuth = $derived(loginMethodCount > 1);

  // Unlink state
  let isUnlinking = $state<string | null>(null);
  let unlinkError = $state('');

  // Password form state
  let showPasswordForm = $state(false);
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordError = $state('');
  let passwordSuccess = $state(false);
  let isUpdatingPassword = $state(false);

  // Password validation
  const passwordLength = $derived(newPassword.length);
  const isMinLength = $derived(passwordLength >= 8);
  const isRecommendedLength = $derived(passwordLength >= 12);
  const passwordsMatch = $derived(newPassword === confirmPassword && confirmPassword.length > 0);
  const isPasswordValid = $derived(isMinLength && passwordsMatch);

  async function linkGoogle() {
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/account`
      }
    });
    
    if (error) {
      console.error('Error linking Google:', error);
      return;
    }
    
    if (data.url) {
      window.location.href = data.url;
    }
  }

  async function linkDiscord() {
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/account`
      }
    });
    
    if (error) {
      console.error('Error linking Discord:', error);
      return;
    }
    
    if (data.url) {
      window.location.href = data.url;
    }
  }

  async function unlinkProvider(provider: 'google' | 'discord') {
    if (!canUnlinkOAuth) {
      unlinkError = 'Cannot unlink your only login method. Add a password or link another account first.';
      return;
    }

    const identity = data.identities.find(
      (i: { id: string; provider: string; user_id: string; identity_id: string }) => i.provider === provider
    );
    if (!identity) {
      unlinkError = 'Identity not found';
      return;
    }

    isUnlinking = provider;
    unlinkError = '';

    const { error } = await supabase.auth.unlinkIdentity(identity as any);

    if (error) {
      unlinkError = error.message;
      isUnlinking = null;
    } else {
      // Refresh page to update linked providers
      window.location.reload();
    }
  }

  async function updatePassword() {
    if (!isPasswordValid) {
      passwordError = 'Please fix the password issues above';
      return;
    }

    isUpdatingPassword = true;
    passwordError = '';

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      passwordError = error.message;
    } else {
      passwordSuccess = true;
      newPassword = '';
      confirmPassword = '';
      showPasswordForm = false;
      // Refresh page to update linked providers
      setTimeout(() => window.location.reload(), 1500);
    }
    isUpdatingPassword = false;
  }
</script>

<svelte:head>
  <title>Account - Group Buy</title>
</svelte:head>

<div class="container max-w-4xl py-8">
  <h1 class="mb-8 text-3xl font-bold">Account</h1>

  <div class="grid gap-6 md:grid-cols-2">
    <!-- Profile Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <User class="h-5 w-5" />
          Profile
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="flex items-center gap-4">
          {#if data.user?.user_metadata?.avatar_url}
            <img
              src={data.user.user_metadata.avatar_url}
              alt="Avatar"
              class="h-16 w-16 rounded-full"
            />
          {:else}
            <div class="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User class="h-8 w-8 text-muted-foreground" />
            </div>
          {/if}
          <div>
            <p class="font-medium">{data.user?.user_metadata?.full_name || data.user?.email}</p>
            <p class="text-sm text-muted-foreground">{data.user?.email}</p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Quick Links -->
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <Package class="h-5 w-5" />
          Quick Links
        </Card.Title>
      </Card.Header>
      <Card.Content class="space-y-2">
        <Button variant="outline" class="w-full justify-start" href="/orders">
          View Order History
        </Button>
        <Button variant="outline" class="w-full justify-start" href="/cart">
          View Cart
        </Button>
      </Card.Content>
    </Card.Root>

    <!-- Linked Accounts -->
    <Card.Root class="md:col-span-2">
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <Link2 class="h-5 w-5" />
          Linked Accounts
        </Card.Title>
        <Card.Description>
          Link multiple accounts to sign in with either provider
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Google -->
          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="flex items-center gap-3">
              <svg class="h-6 w-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <div>
                <p class="font-medium">Google</p>
                {#if hasGoogle}
                  <p class="text-sm text-muted-foreground">Connected</p>
                {/if}
              </div>
            </div>
            {#if hasGoogle}
              <div class="flex items-center gap-2">
                <Badge variant="secondary" class="gap-1">
                  <Check class="h-3 w-3" />
                  Linked
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onclick={() => unlinkProvider('google')}
                  disabled={!canUnlinkOAuth || isUnlinking === 'google'}
                  title={canUnlinkOAuth ? 'Unlink Google account' : 'Cannot unlink only login method'}
                >
                  {#if isUnlinking === 'google'}
                    <span class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                  {:else}
                    <Unlink class="h-3 w-3" />
                  {/if}
                </Button>
              </div>
            {:else}
              <Button variant="outline" size="sm" onclick={linkGoogle}>
                Link
              </Button>
            {/if}
          </div>

          <!-- Discord -->
          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="flex items-center gap-3">
              <svg class="h-6 w-6" viewBox="0 0 24 24">
                <path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <div>
                <p class="font-medium">Discord</p>
                {#if hasDiscord}
                  <p class="text-sm text-muted-foreground">Connected</p>
                {/if}
              </div>
            </div>
            {#if hasDiscord}
              <div class="flex items-center gap-2">
                <Badge variant="secondary" class="gap-1">
                  <Check class="h-3 w-3" />
                  Linked
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onclick={() => unlinkProvider('discord')}
                  disabled={!canUnlinkOAuth || isUnlinking === 'discord'}
                  title={canUnlinkOAuth ? 'Unlink Discord account' : 'Cannot unlink only login method'}
                >
                  {#if isUnlinking === 'discord'}
                    <span class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                  {:else}
                    <Unlink class="h-3 w-3" />
                  {/if}
                </Button>
              </div>
            {:else}
              <Button variant="outline" size="sm" onclick={linkDiscord}>
                Link
              </Button>
            {/if}
          </div>
        </div>

        {#if unlinkError}
          <div class="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {unlinkError}
          </div>
        {/if}

        {#if !canUnlinkOAuth && (hasGoogle || hasDiscord)}
          <p class="mt-4 text-xs text-muted-foreground">
            <Info class="mr-1 inline h-3 w-3" />
            You must have at least one login method. Add a password or link another account before unlinking.
          </p>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Password Section -->
    <Card.Root class="md:col-span-2">
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <Key class="h-5 w-5" />
          Password
        </Card.Title>
        <Card.Description>
          {#if hasEmail}
            Update your password for email login
          {:else}
            Set a password to also sign in with email
          {/if}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {#if passwordSuccess}
          <div class="flex items-center gap-2 text-green-600">
            <Check class="h-5 w-5" />
            <span>{hasEmail ? 'Password updated successfully!' : 'Password set successfully! You can now sign in with email.'}</span>
          </div>
        {:else if showPasswordForm}
          <form onsubmit={(e) => { e.preventDefault(); updatePassword(); }} class="max-w-md space-y-4">
            {#if passwordError}
              <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {passwordError}
              </div>
            {/if}

            <div class="space-y-2">
              <Label for="newPassword">{hasEmail ? 'New Password' : 'Password'}</Label>
              <Input
                id="newPassword"
                type="password"
                bind:value={newPassword}
                required
                minlength={8}
              />
              
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
              <Label for="confirmPassword">Confirm Password</Label>
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

            <div class="flex gap-2">
              <Button type="submit" disabled={isUpdatingPassword || !isPasswordValid}>
                {isUpdatingPassword ? 'Saving...' : (hasEmail ? 'Update Password' : 'Set Password')}
              </Button>
              <Button type="button" variant="outline" onclick={() => { showPasswordForm = false; newPassword = ''; confirmPassword = ''; }}>
                Cancel
              </Button>
            </div>
          </form>
        {:else}
          <div class="flex items-center justify-between">
            <div>
              {#if hasEmail}
                <p class="text-sm text-muted-foreground">Password is set. Click to change it.</p>
              {:else}
                <p class="text-sm text-muted-foreground">No password set. Add one to sign in with email.</p>
              {/if}
            </div>
            <Button variant="outline" onclick={() => showPasswordForm = true}>
              {hasEmail ? 'Change Password' : 'Set Password'}
            </Button>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Saved Addresses -->
    <Card.Root class="md:col-span-2">
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <MapPin class="h-5 w-5" />
          Saved Addresses
        </Card.Title>
      </Card.Header>
      <Card.Content>
        {#if data.addresses.length === 0}
          <p class="text-muted-foreground">No saved addresses. Add one during checkout.</p>
        {:else}
          <div class="grid gap-4 sm:grid-cols-2">
            {#each data.addresses as address (address.id)}
              <div class="rounded-lg border p-4">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="font-medium">{address.name}</p>
                    <p class="text-sm text-muted-foreground">
                      {address.line1}
                      {#if address.line2}, {address.line2}{/if}
                    </p>
                    <p class="text-sm text-muted-foreground">
                      {address.city}, {address.state} {address.postal_code}
                    </p>
                    <p class="text-sm text-muted-foreground">{address.country}</p>
                  </div>
                  {#if address.is_default}
                    <Badge>Default</Badge>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>
