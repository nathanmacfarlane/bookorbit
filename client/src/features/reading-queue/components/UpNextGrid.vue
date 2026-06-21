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
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
    <div
      v-for="(item, index) in local"
      :key="item.book.id"
      draggable="true"
      class="relative group cursor-grab active:cursor-grabbing rounded-lg overflow-hidden border border-border transition-opacity"
      :class="{ 'opacity-50': dragOverIndex === index }"
      @dragstart="onDragStart(index)"
      @dragover="onDragOver($event, index)"
      @drop="handleDrop(index)"
      @dragend="onDragEnd"
    >
      <!-- Cover image -->
      <BookCoverImage
        :book-id="item.book.id"
        type="thumbnail"
        :version="item.book.updatedAt"
        :alt="item.book.title ?? ''"
        class="w-full aspect-[2/3] object-cover bg-muted"
      />

      <!-- Position badge -->
      <span
        class="absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow"
      >
        {{ index + 1 }}
      </span>

      <!-- Remove button (visible on hover) -->
      <button
        class="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-background/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow"
        title="Remove from queue"
        @click.stop="emit('remove', item.book.id)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-3 h-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <!-- Title on hover -->
      <div
        class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <p class="text-xs text-white font-medium truncate">{{ item.book.title ?? 'Untitled' }}</p>
      </div>
    </div>
  </div>
</template>
