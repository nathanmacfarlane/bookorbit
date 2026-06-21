import { ref } from 'vue'

import type { ReadingQueueItem } from '@bookorbit/types'
import { addToReadingQueue, fetchReadingQueue, removeFromReadingQueue, reorderReadingQueue } from '../api/reading-queue.api'

export function useReadingQueue() {
  const items = ref<ReadingQueueItem[]>([])
  const loading = ref(false)
  const error = ref(false)

  async function load() {
    loading.value = true
    error.value = false
    try {
      const res = await fetchReadingQueue()
      items.value = res.items
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  async function add(bookId: number) {
    const res = await addToReadingQueue(bookId)
    items.value = res.items
  }

  async function remove(bookId: number) {
    error.value = false
    const previous = items.value
    items.value = items.value.filter((i) => i.book.id !== bookId)
    try {
      const res = await removeFromReadingQueue(bookId)
      items.value = res.items
    } catch {
      items.value = previous
      error.value = true
    }
  }

  async function applyReorder(reordered: ReadingQueueItem[]) {
    error.value = false
    const previous = items.value
    items.value = reordered.map((item, index) => ({ ...item, position: index + 1 }))
    try {
      const res = await reorderReadingQueue(reordered.map((i) => i.book.id))
      items.value = res.items
    } catch {
      items.value = previous
      error.value = true
    }
  }

  return { items, loading, error, load, add, remove, applyReorder }
}
