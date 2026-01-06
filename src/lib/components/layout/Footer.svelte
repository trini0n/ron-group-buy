<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="border-t py-6">
  <div class="container flex flex-col items-center justify-between gap-4 md:flex-row">
    <p class="text-sm text-muted-foreground">
      © {currentYear} Group Buy. All rights reserved.
    </p>
    <div class="flex gap-4 text-sm text-muted-foreground">
      <a href="https://discord.gg/your-server" target="_blank" class="hover:text-foreground">
        Discord
      </a>
      <span>•</span>
      <span>
        Card data from <a href="https://scryfall.com" target="_blank" class="hover:text-foreground">Scryfall</a>
      </span>
    </div>
  </div>
</footer>
