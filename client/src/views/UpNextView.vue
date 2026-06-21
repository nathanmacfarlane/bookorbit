<script setup lang="ts">
import { onMounted } from 'vue'
import type { ReadingQueueItem } from '@bookorbit/types'
import { useReadingQueue } from '@/features/reading-queue/composables/useReadingQueue'
import { useReadingQueueView } from '@/features/reading-queue/composables/useReadingQueueView'
import UpNextGrid from '@/features/reading-queue/components/UpNextGrid.vue'
import UpNextList from '@/features/reading-queue/components/UpNextList.vue'

const { items, loading, load, remove, applyReorder } = useReadingQueue()
const { view, load: loadView, setView } = useReadingQueueView()

onMounted(() => {
  load()
  loadView()
})

function onReorder(reordered: ReadingQueueItem[]) {
  applyReorder(reordered)
}
</script>

<template>
  <main class="flex-1">
    <div class="flex flex-col gap-4 py-4 sm:py-6 max-w-5xl w-full">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-foreground tracking-tight">Up Next</h1>
        <div class="inline-flex overflow-hidden rounded-md border border-border">
          <button
            class="px-3 py-1 text-sm transition-colors"
            :class="view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
            @click="setView('grid')"
          >
            Grid
          </button>
          <button
            class="px-3 py-1 text-sm transition-colors"
            :class="view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
            @click="setView('list')"
          >
            List
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-muted-foreground">Loading…</div>

      <div v-else-if="items.length === 0" class="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Your queue is empty. Add books from a book's page or the book dock.
      </div>

      <template v-else>
        <UpNextGrid v-if="view === 'grid'" :items="items" @reorder="onReorder" @remove="remove" />
        <UpNextList v-else :items="items" @reorder="onReorder" @remove="remove" />
      </template>
    </div>
  </main>
</template>
