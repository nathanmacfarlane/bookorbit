import { ref } from 'vue'

import type { ReadingQueueView } from '@bookorbit/types'
import { fetchReadingQueueView, saveReadingQueueView } from '../api/reading-queue.api'

export function useReadingQueueView() {
  const view = ref<ReadingQueueView>('grid')

  async function load() {
    try {
      view.value = await fetchReadingQueueView()
    } catch {
      view.value = 'grid'
    }
  }

  async function setView(next: ReadingQueueView) {
    view.value = next
    try {
      await saveReadingQueueView(next)
    } catch {
      // non-fatal; view stays applied locally
    }
  }

  return { view, load, setView }
}
