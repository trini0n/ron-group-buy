<script lang="ts">
  interface Props {
    color: 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
    size?: number;
    class?: string;
  }

  let { color, size = 24, class: className = '' }: Props = $props();

  // Map color codes to their labels for accessibility
  const colorLabels: Record<string, string> = {
    W: 'White',
    U: 'Blue',
    B: 'Black',
    R: 'Red',
    G: 'Green',
    C: 'Colorless'
  };

  // Scryfall SVG CDN URL
  const svgUrl = $derived(`https://svgs.scryfall.io/card-symbols/${color}.svg`);
  const label = $derived(colorLabels[color] ?? color);
</script>

<img
  src={svgUrl}
  alt="{label} mana"
  width={size}
  height={size}
  class={className}
  loading="lazy"
  referrerpolicy="no-referrer"
/>
