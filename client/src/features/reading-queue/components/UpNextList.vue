<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ReadingQueueItem } from '@bookorbit/types'
import BookCoverImage from '@/features/book/components/BookCoverImage.vue'
import { useDraggableList } from '@/features/dashboard/composables/useDraggableList'

const props = defineProps<{
  items: ReadingQueueItem[]
}>()

const emit = defineEmits<{
  reorder: [items: ReadingQueueItem[]]
  remove: [bookId: number]
}>()

const local = ref<ReadingQueueItem[]>([...props.items])

watch(
  () => props.items,
  (next) => {
    local.value = [...next]
  },
)

const { onDragStart, onDragOver, onDrop, onDragEnd, dragOverIndex } = useDraggableList(local)

function handleDrop(index: number) {
  onDrop(index)
  emit('reorder', [...local.value])
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      v-for="(item, index) in local"
      :key="item.book.id"
      draggable="true"
      class="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors cursor-grab active:cursor-grabbing"
      :class="{ 'opacity-50': dragOverIndex === index }"
      @dragstart="onDragStart(index)"
      @dragover="onDragOver($event, index)"
      @drop="handleDrop(index)"
      @dragend="onDragEnd"
    >
      <!-- Position number -->
      <span class="w-7 shrink-0 text-center text-lg font-bold text-muted-foreground">
        {{ index + 1 }}
      </span>

      <!-- Cover thumbnail -->
      <BookCoverImage
        :book-id="item.book.id"
        type="thumbnail"
        :version="item.book.updatedAt"
        :alt="item.book.title ?? ''"
        class="h-14 w-10 object-cover rounded shrink-0 bg-muted"
      />

      <!-- Title + authors -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-foreground truncate">
          {{ item.book.title ?? 'Untitled' }}
        </p>
        <p v-if="item.book.authors.length" class="text-xs text-muted-foreground truncate mt-0.5">
          {{ item.book.authors.join(', ') }}
        </p>
      </div>

      <!-- Drag handle affordance -->
      <span class="shrink-0 text-muted-foreground/50 cursor-grab" title="Drag to reorder">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </span>

      <!-- Remove button -->
      <button
        class="shrink-0 flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Remove from queue"
        @click.stop="emit('remove', item.book.id)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </div>
</template>
