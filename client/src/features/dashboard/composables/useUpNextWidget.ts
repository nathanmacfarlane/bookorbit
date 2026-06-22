import { onMounted, ref } from 'vue'

import type { UpNextWidgetData } from '@bookorbit/types'
import { fetchUpNext } from '../api/dashboard-widget.api'

export function useUpNextWidget() {
  const data = ref<UpNextWidgetData | null>(null)
  const loading = ref(true)
  const error = ref(false)

  async function load() {
    loading.value = true
    error.value = false
    try {
      data.value = await fetchUpNext()
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { data, loading, error, refresh: load }
}
