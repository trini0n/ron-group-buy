<script lang="ts">
  import { buttonVariants, type Variant, type Size } from './index';
  import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  type BaseProps = {
    variant?: Variant;
    size?: Size;
    class?: string;
    builders?: Array<{ action: (node: HTMLElement) => void }>;
  };

  type ButtonProps = BaseProps & HTMLButtonAttributes & { href?: never };
  type AnchorProps = BaseProps & HTMLAnchorAttributes & { href: string };

  type Props = ButtonProps | AnchorProps;

  let {
    class: className,
    variant = 'default',
    size = 'default',
    href,
    builders = [],
    children,
    ...restProps
  }: Props = $props();
</script>

{#if href}
  <a
    {href}
    class={cn(buttonVariants({ variant, size }), className)}
    use:action={builders}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    class={cn(buttonVariants({ variant, size }), className)}
    use:action={builders}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}

{#snippet action(node: HTMLElement)}
  {#each builders as builder}
    {builder.action(node)}
  {/each}
{/snippet}
