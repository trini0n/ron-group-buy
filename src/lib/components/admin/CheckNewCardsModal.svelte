<script lang="ts">
  import * as Dialog from '$components/ui/dialog'
  import { Button } from '$components/ui/button'
  import { Label } from '$components/ui/label'
  import { RadioGroup, RadioGroupItem } from '$components/ui/radio-group'
  import { Textarea } from '$components/ui/textarea'
  import { toast } from 'svelte-sonner'
  import { ClipboardCopy, Search, Loader2, CheckCircle2 } from 'lucide-svelte'

  interface NewCard {
    card_name: string
    set_code: string
    collector_number: string
    language?: string
  }

  interface Props {
    open: boolean
  }

  let { open = $bindable() }: Props = $props()

  let inputText = $state('')
  let cardType = $state<'Normal' | 'Holo' | 'Foil'>('Normal')
  let isChecking = $state(false)

  interface CheckResult {
    new_cards: NewCard[]
    new_count: number
    existing_count: number
    total_count: number
  }

  let result = $state<CheckResult | null>(null)
  let parseError = $state('')

  // Format the output list as "Card Name | SetCode | Collector#" (+ language when non-English)
  const outputText = $derived(
    result
      ? result.new_cards
          .map((c) => {
            const lang = c.language && c.language.toLowerCase() !== 'en' ? ` ${c.language.toUpperCase()}` : ''
            return `${c.card_name} | ${c.set_code} | ${c.collector_number}${lang}`
          })
          .join('\n')
      : ''
  )

  /**
   * Known multi-word frame values that contain spaces (to distinguish from lang codes).
   * Single-word frames (Borderless, Showcase, Retro, etc.) are ignored automatically
   * because they're longer than 3 chars and don't match the lang pattern.
   */
  const LANG_PATTERN = /^[a-zA-Z]{2,3}$/

  /**
   * Try to parse a line in bracket format:
   *   Card Name [lang?] [frame?] [set] #CN
   *
   * Rules:
   * - Must contain at least one [bracket] group followed by #CN
   * - Last bracket group before #CN is always the set code
   * - Earlier bracket groups are optional: [lang] (2-3 letter code) or [frame] (ignored)
   * - Language defaults to 'en' when absent
   *
   * Examples:
   *   Ragavan, Nimble Pilferer [MH2] #138
   *   Ragavan, Nimble Pilferer [JA] [MH2] #138
   *   Mikaeus, the Unhallowed [Borderless] [CMM] #675
   *   Mikaeus, the Unhallowed [JA] [Borderless] [CMM] #675
   */
  function parseScryfallLine(line: string): NewCard | null {
    // Must have at least one [bracket] and a #collector_number at the end
    if (!line.includes('[') || !line.includes('#')) return null

    // Extract collector number: last #word token after all bracket groups
    // Allow collector numbers like "138a", "675", "P1"
    const cnMatch = line.match(/\[([^\]]+)\]\s+#(\S+)\s*$/)
    if (!cnMatch) return null

    const set_code = cnMatch[1].trim()
    const collector_number = cnMatch[2].trim()

    // Everything before the final [set] #CN block
    const beforeSetCn = line.slice(0, line.lastIndexOf('[' + cnMatch[1] + ']')).trim()

    // Extract all remaining bracket groups from beforeSetCn (these are optional [lang]/[frame])
    const bracketGroups = [...beforeSetCn.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim())

    // Card name = everything before the first bracket group (or the whole beforeSetCn if none)
    const firstBracket = beforeSetCn.indexOf('[')
    const card_name = (firstBracket === -1 ? beforeSetCn : beforeSetCn.slice(0, firstBracket)).trim()
    if (!card_name) return null

    // Identify language: a bracket group that is exactly 2-3 letters and looks like a language code
    // Use the first such group found (lang typically appears first)
    const langGroup = bracketGroups.find((g) => LANG_PATTERN.test(g))
    const language = langGroup ? langGroup.toLowerCase() : undefined

    return { card_name, set_code, collector_number, language }
  }

  /**
   * Split a line by delimiter, respecting CSV-style double-quoted fields.
   * Handles cases like: "Mikaeus, the Unhallowed",CMM,675
   */
  function splitLine(line: string, delimiter: string): string[] {
    if (delimiter !== ',') {
      // Pipe and tab: simple split, no quoting needed
      return line.split(delimiter).map((p) => p.trim())
    }
    // CSV-aware split: track whether we're inside a quoted field
    const parts: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        // Toggle quoted mode; strip the quote character itself
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        parts.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    parts.push(current.trim())
    return parts
  }

  /**
   * Parse a pasted list or CSV into card objects.
   * Supports pipe-delimited, tab-delimited, and comma-delimited formats.
   * Skips blank lines and header lines (if first token looks like a header).
   */
  function parseInput(raw: string): NewCard[] | null {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) return null

    const cards: NewCard[] = []
    for (const line of lines) {
      // Try Scryfall format first: Card Name [Frame] [SET] #cn lang
      const scryfallCard = parseScryfallLine(line)
      if (scryfallCard) {
        cards.push(scryfallCard)
        continue
      }

      // Fall back to delimited format: pipe → tab → comma
      const delimiter = line.includes('|') ? '|' : line.includes('\t') ? '\t' : ','
      const parts = splitLine(line, delimiter)

      if (parts.length < 3) {
        // Not enough columns — skip (could be a header or blank)
        continue
      }

      const [card_name, set_code, collector_number] = parts as [string, string, string, ...string[]]

      // Skip if looks like a header row
      if (card_name.toLowerCase() === 'card name' || card_name.toLowerCase() === 'name') {
        continue
      }

      if (!card_name || !set_code || !collector_number) continue

      cards.push({ card_name, set_code, collector_number })
    }

    return cards.length > 0 ? cards : null
  }

  async function handleCheck() {
    parseError = ''
    result = null

    const cards = parseInput(inputText)
    if (!cards) {
      parseError = 'No valid cards found. Expected: Card Name | SetCode | Collector#  or  Card Name [SET] #cn'
      return
    }

    isChecking = true
    try {
      const res = await fetch('/api/admin/inventory/check-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, card_type: cardType })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unknown error' }))
        toast.error(err.message || `Error ${res.status}`)
        return
      }

      result = await res.json()
    } catch (e) {
      toast.error('Failed to reach server')
    } finally {
      isChecking = false
    }
  }

  async function handleCopy() {
    if (!outputText) return
    try {
      await navigator.clipboard.writeText(outputText)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy — please select and copy manually')
    }
  }

  function handleClose() {
    open = false
    inputText = ''
    cardType = 'Normal'
    result = null
    parseError = ''
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(v) => {
    if (!v) handleClose()
  }}
>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Search class="h-5 w-5" />
        Check New Cards
      </Dialog.Title>
      <Dialog.Description>
        Paste a card list to find which cards are not yet in the library for the selected type.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-5">
      <!-- Card Type Selector -->
      <div class="space-y-2">
        <Label>Card Type</Label>
        <RadioGroup bind:value={cardType} class="flex gap-6">
          {#each ['Normal', 'Holo', 'Foil'] as type}
            <div class="flex items-center gap-2">
              <RadioGroupItem value={type} id="type-{type.toLowerCase()}" />
              <Label for="type-{type.toLowerCase()}" class="cursor-pointer font-normal">
                {type}
              </Label>
            </div>
          {/each}
        </RadioGroup>
      </div>

      <!-- Input -->
      <div class="space-y-2">
        <Label for="card-input">Card List</Label>
        <Textarea
          id="card-input"
          bind:value={inputText}
          placeholder={'Ragavan, Nimble Pilferer [MH2] #138\nMikaeus, the Unhallowed [Borderless] [CMM] #675\nRagavan [JA] [Extended Art] [MH2] #138\n\nBracket format: Card Name [lang?] [frame?] [set] #CN\nAlso supports: pipe | tab | comma delimited'}
          class="h-36 font-mono text-sm"
        />
        {#if parseError}
          <p class="text-sm text-destructive">{parseError}</p>
        {/if}
      </div>

      <!-- Results -->
      {#if result}
        <div class="space-y-3 rounded-lg border bg-muted/40 p-4">
          <!-- Summary row -->
          <div class="flex items-center gap-4 text-sm">
            <span class="font-medium">
              {result.total_count} checked
            </span>
            <span class="text-muted-foreground">·</span>
            <span class="font-semibold text-green-600">
              {result.new_count} new
            </span>
            <span class="text-muted-foreground">·</span>
            <span class="text-muted-foreground">
              {result.existing_count} already in library
            </span>
          </div>

          {#if result.new_count === 0}
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 class="h-4 w-4 text-green-600" />
              All cards already exist in the library for {cardType} type.
            </div>
          {:else}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label class="text-xs uppercase tracking-wide text-muted-foreground">
                  New cards ({result.new_count})
                </Label>
                <Button variant="outline" size="sm" onclick={handleCopy} class="h-7 gap-1.5 text-xs">
                  <ClipboardCopy class="h-3.5 w-3.5" />
                  Copy List
                </Button>
              </div>
              <pre
                class="max-h-48 overflow-y-auto rounded border bg-background p-3 text-xs leading-relaxed">{outputText}</pre>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <Dialog.Footer class="gap-2">
      <Button variant="outline" onclick={handleClose}>Close</Button>
      <Button onclick={handleCheck} disabled={!inputText.trim() || isChecking}>
        {#if isChecking}
          <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          Checking...
        {:else}
          <Search class="mr-2 h-4 w-4" />
          Check Cards
        {/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
