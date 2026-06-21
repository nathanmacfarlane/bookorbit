<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2, Plus, Search, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useGlobalSearch } from '@/features/book/composables/useGlobalSearch'
import { useReadingQueue } from '../composables/useReadingQueue'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { add } = useReadingQueue()

const query = ref('')
const { results, loading, settled } = useGlobalSearch(query)
const addingIds = ref<Set<number>>(new Set())

watch(
  () => props.open,
  (open) => {
    if (!open) query.value = ''
  },
)

async function handleAdd(bookId: number, title: string | null) {
  if (addingIds.value.has(bookId)) return
  addingIds.value = new Set([...addingIds.value, bookId])
  try {
    await add(bookId)
    toast.success(`Added "${title ?? 'Book'}" to Up Next`)
  } catch {
    toast.error('Could not add to Up Next')
  } finally {
    const next = new Set(addingIds.value)
    next.delete(bookId)
    addingIds.value = next
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent
      side="bottom"
      class="max-h-[80vh] overflow-y-auto sm:inset-x-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg sm:rounded-t-lg"
    >
      <SheetHeader>
        <SheetTitle class="flex items-center gap-2">
          <Plus :size="16" />
          Add Books to Up Next
        </SheetTitle>
      </SheetHeader>

      <div class="px-4 pb-4 space-y-4">
        <!-- Search input -->
        <div class="flex items-center gap-1.5 h-9 rounded-lg border border-input bg-background px-3">
          <Search class="size-3.5 text-muted-foreground shrink-0" />
          <input
            v-model="query"
            placeholder="Search your library…"
            class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/80"
            autofocus
          />
          <button v-if="query" class="text-muted-foreground hover:text-foreground shrink-0" @click="query = ''">
            <X class="size-3.5" />
          </button>
        </div>

        <!-- Results -->
        <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
          <Loader2 class="size-4 animate-spin" />
          Searching…
        </div>

        <div v-else-if="settled && results.length === 0" class="text-center py-6 text-sm text-muted-foreground">No books found</div>

        <div v-else-if="results.length > 0" class="space-y-1">
          <button
            v-for="book in results"
            :key="book.id"
            class="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-muted transition-colors text-left"
            :class="addingIds.has(book.id) ? 'opacity-60 cursor-wait' : 'cursor-pointer'"
            :disabled="addingIds.has(book.id)"
            @click="handleAdd(book.id, book.title)"
          >
            <div class="flex flex-col min-w-0">
              <span class="text-sm font-medium text-foreground truncate">{{ book.title ?? 'Untitled' }}</span>
              <span class="text-xs text-muted-foreground truncate">{{ book.authors.join(', ') || book.libraryName }}</span>
            </div>
            <Loader2 v-if="addingIds.has(book.id)" class="size-4 animate-spin text-muted-foreground shrink-0 ml-2" />
            <Plus v-else class="size-4 text-muted-foreground shrink-0 ml-2" />
          </button>
        </div>

        <div v-else class="text-center py-4 text-sm text-muted-foreground">Type to search your library</div>

        <!-- Close -->
        <div class="pt-2 border-t border-border">
          <button
            class="w-full h-9 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors"
            @click="emit('update:open', false)"
          >
            Done
          </button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
