<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { buttonVariants } from '$lib/components/ui/button';
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import { Check, ChevronsUpDown } from "lucide-svelte";
  import { tick } from "svelte";
  import { countries, getCountryByName } from '$lib/data/countries';

  let {
    phoneNumber = $bindable(),
    country = 'US', // ISO-2 Country Name/Code string to prepopulate flag
    placeholder = '123456789',
    required = false,
    id = 'phone',
    class: className = ''
  } = $props<{
    phoneNumber: string;
    country?: string;
    placeholder?: string;
    required?: boolean;
    id?: string;
    class?: string;
  }>();

  // Internal component state
  let selectedIso2 = $state('US');
  let openCountrySelect = $state(false);
  let nationalNumber = $state('');
  
  // Track previous props to prevent Svelte 5 $effect infinite loops
  let prevCountryProp = $state<string | null>(null);
  let prevPhoneProp = $state<string | null>(null);

  $effect(() => {
    // 1. Map ISO country prop to internal selected state
    if (country !== prevCountryProp) {
      const targetCountryData = getCountryByName(country);
      if (targetCountryData) {
        selectedIso2 = targetCountryData.iso2;
      }
      prevCountryProp = country;
    }

    const currentCode = countries.find(c => c.iso2 === selectedIso2)?.dialCode || '';

    // 2. React to external phoneNumber prop changes (e.g., loading saved address or initial load)
    if (phoneNumber !== prevPhoneProp) {
        prevPhoneProp = phoneNumber;
        
        let newNational = phoneNumber || '';
        // Aggressively strip the dial code if it exists at the start of the string
        if (currentCode && newNational.startsWith(currentCode)) {
            newNational = newNational.substring(currentCode.length).trim();
        } else if (currentCode && newNational.startsWith(currentCode.replace('+', ''))) {
            // Also handle if they stored "1408..." instead of "+1 408..." (browser autofill)
            newNational = newNational.substring(currentCode.length - 1).trim();
        }
        
        // Update the internal text input
        if (nationalNumber !== newNational) {
            nationalNumber = newNational;
        }
    } else {
        // 3. React to internal nationalNumber/country changes and emit back to parent
        const formattedNewPhone = nationalNumber && nationalNumber.trim() ? `${currentCode} ${nationalNumber.trim()}` : '';
        if (phoneNumber !== formattedNewPhone) {
            phoneNumber = formattedNewPhone;
            prevPhoneProp = formattedNewPhone; // sync tracker so we don't treat this as an external change next tick
        }
    }
  });

  async function closeAndFocusTrigger() {
    openCountrySelect = false;
    await tick();
    document.getElementById(`trigger-btn-${id}`)?.focus();
  }
</script>

<div class="flex relative gap-2 {className}">
  <Popover.Root bind:open={openCountrySelect}>
    <Popover.Trigger
      class={buttonVariants({ variant: "outline", className: "w-[110px] justify-between px-3" })}
      role="combobox"
      aria-expanded={openCountrySelect}
    >
      {#if selectedIso2}
        {@const countryInfo = countries.find(c => c.iso2 === selectedIso2)}
        <span class="mr-2 text-lg">{countryInfo?.flag}</span>
        <span>{countryInfo?.dialCode}</span>
      {:else}
        Select...
      {/if}
      <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Popover.Trigger>
    <Popover.Content class="w-[250px] p-0" align="start">
      <Command.Root>
        <Command.Input placeholder="Search country..." />
        <Command.List>
          <Command.Empty>No country found.</Command.Empty>
          <Command.Group>
            {#each countries as c}
              <Command.Item
                value={c.iso2 + " " + c.name + " " + c.dialCode}
                onSelect={() => {
                  selectedIso2 = c.iso2;
                  closeAndFocusTrigger();
                }}
              >
                <Check
                  class={`mr-2 h-4 w-4 ${selectedIso2 !== c.iso2 ? "text-transparent" : ""}`}
                />
                <span class="mr-2 text-lg">{c.flag}</span>
                <span class="flex-1 text-sm">{c.name}</span>
                <span class="text-sm text-muted-foreground">{c.dialCode}</span>
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>

  <!-- Hidden trigger input script -->
  <div class="hidden" id="trigger-btn-{id}"></div>
  
  <Input 
    {id} 
    type="tel"
    {placeholder}
    {required}
    bind:value={nationalNumber}
    class="flex-1"
  />
</div>
