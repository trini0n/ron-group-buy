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
  
  // Track previous country to react to external changes
  let prevCountryProp = $state<string | null>(null);
  let hasInitialized = $state(false);

  // Helper to parse an existing full string phone number + code into just the national part
  const parseExistingPhone = (fullPhone: string, code: string) => {
    if (fullPhone.startsWith(code)) {
      return fullPhone.substring(code.length).trim();
    }
    return fullPhone;
  };

  $effect(() => {
    // 1. Initial hydration and Country prop changes
    if (country !== prevCountryProp) {
      const targetCountryData = getCountryByName(country);
      if (targetCountryData) {
        selectedIso2 = targetCountryData.iso2;
      }
      prevCountryProp = country;
      
      // If we just mapped the initial country prop, and we have an initial phoneNumber prop,
      // extract the national number using the newly found country dialCode.
      if (!hasInitialized) {
        if (phoneNumber) {
           const code = targetCountryData?.dialCode || '';
           nationalNumber = parseExistingPhone(phoneNumber, code);
        } else {
           nationalNumber = '';
        }
        hasInitialized = true;
      } else {
        // If the country prop changed but we'd already initialized, we don't obliterate the 
        // national number, we just assume the user is typing a new number for the new country.
      }
    }
    
    // 2. React to parent completely resetting phoneNumber to '' (like clearing a form)
    if (hasInitialized && !phoneNumber && nationalNumber) {
        nationalNumber = '';
    }
    
    // 3. Update the bound parent `phoneNumber` payload whenever our internal pieces change
    const currentCode = countries.find(c => c.iso2 === selectedIso2)?.dialCode || '';
    if (nationalNumber && nationalNumber.trim()) {
      phoneNumber = `${currentCode} ${nationalNumber.trim()}`;
    } else {
      phoneNumber = '';
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
