<script setup lang="ts">
import { ref } from 'vue'
import { ListPlus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { addToReadingQueue } from '../api/reading-queue.api'

const props = defineProps<{ bookId: number }>()

const busy = ref(false)

async function handleClick() {
  if (busy.value) return
  busy.value = true
  try {
    await addToReadingQueue(props.bookId)
    toast.success('Added to Up Next')
  } catch {
    toast.error('Could not add to Up Next')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    class="flex w-full items-center gap-2 px-2 py-1.5 rounded text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :disabled="busy"
    @click="handleClick"
  >
    <ListPlus class="size-3.5" />
    Add to Up Next
  </button>
</template>
