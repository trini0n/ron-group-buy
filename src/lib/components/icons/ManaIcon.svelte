<script lang="ts">
  interface Props {
    color: 'W' | 'U' | 'B' | 'R' | 'G';
    size?: number;
    class?: string;
  }

  let { color, size = 24, class: className = '' }: Props = $props();

  const colorConfig = {
    W: {
      bg: '#F8F6D8',
      stroke: '#C9B775',
      fill: '#F8F6D8',
      icon: 'sun'
    },
    U: {
      bg: '#C1D7E9',
      stroke: '#0E68AB',
      fill: '#C1D7E9', 
      icon: 'water'
    },
    B: {
      bg: '#2D2D2D',
      stroke: '#150B00',
      fill: '#2D2D2D',
      icon: 'skull'
    },
    R: {
      bg: '#EB9F82',
      stroke: '#D32F2F',
      fill: '#EB9F82',
      icon: 'fire'
    },
    G: {
      bg: '#A3C095',
      stroke: '#196C3A',
      fill: '#A3C095',
      icon: 'tree'
    }
  };

  const config = $derived(colorConfig[color]);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 100 100"
  class={className}
  role="img"
  aria-label="{color === 'W' ? 'White' : color === 'U' ? 'Blue' : color === 'B' ? 'Black' : color === 'R' ? 'Red' : 'Green'} mana"
>
  <!-- Outer circle with gradient -->
  <defs>
    <radialGradient id="mana-{color}-gradient" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="{config.bg}" />
      <stop offset="100%" stop-color="{config.stroke}" stop-opacity="0.3" />
    </radialGradient>
  </defs>
  
  <circle
    cx="50"
    cy="50"
    r="46"
    fill="url(#mana-{color}-gradient)"
    stroke="{config.stroke}"
    stroke-width="4"
  />

  {#if color === 'W'}
    <!-- White - Sun symbol -->
    <g fill="{config.stroke}" transform="translate(50,50)">
      <circle r="12" />
      {#each [0, 45, 90, 135, 180, 225, 270, 315] as angle}
        <rect
          x="-3"
          y="-28"
          width="6"
          height="12"
          rx="2"
          transform="rotate({angle})"
        />
      {/each}
    </g>
  {:else if color === 'U'}
    <!-- Blue - Water drop -->
    <path
      d="M50 20 C50 20 30 45 30 60 C30 73 38 80 50 80 C62 80 70 73 70 60 C70 45 50 20 50 20Z"
      fill="{config.stroke}"
    />
  {:else if color === 'B'}
    <!-- Black - Skull -->
    <g fill="#BAB1AB" transform="translate(50,52)">
      <ellipse rx="22" ry="24" />
      <ellipse cx="-9" cy="-5" rx="6" ry="8" fill="#150B00" />
      <ellipse cx="9" cy="-5" rx="6" ry="8" fill="#150B00" />
      <path d="M-4 8 L0 14 L4 8" stroke="#150B00" stroke-width="3" fill="none" />
      <rect x="-12" y="16" width="5" height="8" rx="1" fill="#150B00" />
      <rect x="-4" y="16" width="5" height="8" rx="1" fill="#150B00" />
      <rect x="4" y="16" width="5" height="8" rx="1" fill="#150B00" />
    </g>
  {:else if color === 'R'}
    <!-- Red - Fire/Flame -->
    <path
      d="M50 20 C45 35 35 40 35 55 C35 68 42 78 50 78 C58 78 65 68 65 55 C65 40 55 35 50 20Z M50 40 C48 50 45 52 45 60 C45 66 47 70 50 70 C53 70 55 66 55 60 C55 52 52 50 50 40Z"
      fill="{config.stroke}"
      fill-rule="evenodd"
    />
  {:else if color === 'G'}
    <!-- Green - Tree -->
    <g fill="{config.stroke}" transform="translate(50,50)">
      <path d="M0 -30 L-18 0 L-8 0 L-8 20 L8 20 L8 0 L18 0 Z" />
      <rect x="-5" y="18" width="10" height="15" fill="#5D4037" />
    </g>
  {/if}
</svg>
