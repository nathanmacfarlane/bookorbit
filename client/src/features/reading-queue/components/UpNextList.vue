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

      <!-- Clickable open region (cover + title/authors) -->
      <div data-testid="upnext-open" class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" @click="emit('open', item.book.id)">
        <BookCoverImage
          :book-id="item.book.id"
          type="thumbnail"
          :version="item.book.updatedAt"
          :alt="item.book.title ?? ''"
          class="h-14 w-10 object-cover rounded shrink-0 bg-muted"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-foreground truncate">
            {{ item.book.title ?? 'Untitled' }}
          </p>
          <p v-if="item.book.authors.length" class="text-xs text-muted-foreground truncate mt-0.5">
            {{ item.book.authors.join(', ') }}
          </p>
        </div>
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

      <!-- 3-dot menu -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            data-testid="upnext-menu"
            class="shrink-0 flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Actions"
            @click.stop
          >
            <MoreVertical class="w-4 h-4" />
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
