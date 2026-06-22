<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ListOrdered } from 'lucide-vue-next'

import { useUpNextWidget } from '../../composables/useUpNextWidget'

const { data, loading, error } = useUpNextWidget()
</script>

<template>
  <div class="flex h-full flex-col p-3">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <ListOrdered :size="16" class="text-primary/90" />
        <span class="text-[15px] font-semibold text-foreground">Up Next</span>
      </div>
      <RouterLink :to="{ name: 'up-next' }" class="text-xs text-primary hover:underline">View all →</RouterLink>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 flex-col gap-2">
      <div v-for="i in 3" :key="i" class="h-4 w-full animate-pulse rounded bg-muted" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-1 items-center justify-center text-sm text-muted-foreground">Failed to load</div>

    <!-- Empty -->
    <div v-else-if="!data || data.items.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <ListOrdered :size="16" class="text-muted-foreground/60" />
      </div>
      <p class="text-center text-xs text-muted-foreground">Your queue is empty.</p>
    </div>

    <!-- Queue items -->
    <ol v-else class="flex flex-1 flex-col gap-1.5 overflow-hidden">
      <li v-for="(item, index) in data.items" :key="item.book.id" class="flex items-center gap-2 text-sm">
        <span class="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">{{ index + 1 }}</span>
        <span class="truncate text-foreground">{{ item.book.title ?? 'Untitled' }}</span>
      </li>
    </ol>
  </div>
</template>
