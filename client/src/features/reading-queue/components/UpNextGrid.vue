<script setup lang="ts">
import { ref, watch } from 'vue'
import { MoreVertical } from 'lucide-vue-next'
import type { ReadingQueueItem } from '@bookorbit/types'
import BookCoverImage from '@/features/book/components/BookCoverImage.vue'
import { useDraggableList } from '@/features/dashboard/composables/useDraggableList'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'

const props = defineProps<{
  items: ReadingQueueItem[]
}>()

const emit = defineEmits<{
  reorder: [items: ReadingQueueItem[]]
  remove: [bookId: number]
  open: [bookId: number]
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
      <!-- Clickable open region (cover + title) -->
      <div data-testid="upnext-open" class="cursor-pointer" @click="emit('open', item.book.id)">
        <BookCoverImage
          :book-id="item.book.id"
          type="thumbnail"
          :version="item.book.updatedAt"
          :alt="item.book.title ?? ''"
          class="w-full aspect-[2/3] object-cover bg-muted"
        />
        <div
          class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <p class="text-xs text-white font-medium truncate">{{ item.book.title ?? 'Untitled' }}</p>
        </div>
      </div>

      <!-- Position badge -->
      <span
        class="pointer-events-none absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow"
      >
        {{ index + 1 }}
      </span>

      <!-- 3-dot menu (visible on hover) -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            data-testid="upnext-menu"
            class="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-background/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow"
            title="Actions"
            @click.stop
          >
            <MoreVertical class="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem data-testid="upnext-view-details" @click="emit('open', item.book.id)">View details</DropdownMenuItem>
          <DropdownMenuItem data-testid="upnext-remove" @click="emit('remove', item.book.id)">Remove from queue</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
