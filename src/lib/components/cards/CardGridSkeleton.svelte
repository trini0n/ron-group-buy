<script lang="ts">
  import { Skeleton } from '$components/ui/skeleton';

  interface Props {
    count?: number;
  }

  let { count = 10 }: Props = $props();
</script>

<!-- Filter Sidebar Skeleton -->
<div class="flex flex-col gap-6 lg:flex-row">
  <aside class="w-full shrink-0 lg:w-64">
    <div class="space-y-6 rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between">
        <Skeleton class="h-5 w-16" />
      </div>
      
      <!-- Set filter skeleton -->
      <div class="space-y-2">
        <Skeleton class="h-4 w-8" />
        <Skeleton class="h-10 w-full" />
      </div>
      
      <!-- Color identity skeleton -->
      <div class="space-y-2">
        <Skeleton class="h-4 w-24" />
        <div class="flex flex-wrap gap-2">
          {#each Array(5) as _}
            <Skeleton class="h-8 w-8 rounded-full" />
          {/each}
        </div>
      </div>
      
      <!-- Card type skeleton -->
      <div class="space-y-2">
        <Skeleton class="h-4 w-20" />
        <div class="grid grid-cols-2 gap-2">
          {#each Array(8) as _}
            <Skeleton class="h-5 w-full" />
          {/each}
        </div>
      </div>
      
      <!-- Finish skeleton -->
      <div class="space-y-2">
        <Skeleton class="h-4 w-12" />
        <div class="space-y-2">
          <Skeleton class="h-5 w-20" />
          <Skeleton class="h-5 w-14" />
        </div>
      </div>
    </div>
  </aside>

  <!-- Card Grid Skeleton -->
  <div class="flex-1">
    <!-- Results count skeleton -->
    <div class="mb-4 flex items-center justify-between">
      <Skeleton class="h-4 w-48" />
      <Skeleton class="h-4 w-24" />
    </div>
    
    <!-- Card grid -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {#each Array(count) as _}
        <div class="space-y-2">
          <!-- Card image skeleton -->
          <Skeleton class="aspect-[488/680] w-full rounded-lg" />
          <!-- Card name skeleton -->
          <Skeleton class="h-4 w-3/4" />
          <!-- Card set/price skeleton -->
          <div class="flex justify-between">
            <Skeleton class="h-3 w-16" />
            <Skeleton class="h-3 w-12" />
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
