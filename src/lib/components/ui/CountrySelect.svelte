<script lang="ts">
  import { buttonVariants } from '$lib/components/ui/button';
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import { Check, ChevronsUpDown } from "lucide-svelte";
  import { tick } from "svelte";
  import { countries } from '$lib/data/countries';

  let {
    value = $bindable('US'),
    id = 'country',
    required = false,
    class: className = ''
  } = $props<{
    value: string;
    id?: string;
    required?: boolean;
    class?: string;
  }>();

  let open = $state(false);

  let selectedCountry = $derived(countries.find(c => c.iso2 === value));

  async function closeAndFocus() {
    open = false;
    await tick();
    document.getElementById(`country-trigger-${id}`)?.focus();
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    id="country-trigger-{id}"
    class={buttonVariants({ variant: "outline", className: `w-full justify-between px-3 font-normal ${className}` })}
    role="combobox"
    aria-expanded={open}
  >
    <span class="flex items-center gap-2 truncate">
      {#if selectedCountry}
        <span class="text-lg">{selectedCountry.flag}</span>
        <span class="truncate">{selectedCountry.name}</span>
      {:else}
        <span class="text-muted-foreground">Select country...</span>
      {/if}
    </span>
    <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
  </Popover.Trigger>
  <Popover.Content class="w-[300px] p-0" align="start">
    <Command.Root>
      <Command.Input placeholder="Search country..." />
      <Command.List>
        <Command.Empty>No country found.</Command.Empty>
        <Command.Group>
          {#each countries as c}
            <Command.Item
              value={c.iso2 + " " + c.name}
              onSelect={() => {
                value = c.iso2;
                closeAndFocus();
              }}
            >
              <Check
                class={`mr-2 h-4 w-4 ${value !== c.iso2 ? "text-transparent" : ""}`}
              />
              <span class="mr-2 text-lg">{c.flag}</span>
              <span class="flex-1 text-sm">{c.name}</span>
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
