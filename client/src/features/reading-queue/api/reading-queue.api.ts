import type { ReadingQueueResponse, ReadingQueueView } from '@bookorbit/types'
import { api } from '@/lib/api'

export async function fetchReadingQueue(): Promise<ReadingQueueResponse> {
  const res = await api('/api/v1/reading-queue')
  if (!res.ok) throw new Error('Failed to fetch reading queue')
  return res.json()
}

export async function addToReadingQueue(bookId: number): Promise<ReadingQueueResponse> {
  const res = await api('/api/v1/reading-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookId }),
  })
  if (!res.ok) throw new Error('Failed to add to reading queue')
  return res.json()
}

export async function removeFromReadingQueue(bookId: number): Promise<ReadingQueueResponse> {
  const res = await api(`/api/v1/reading-queue/${bookId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove from reading queue')
  return res.json()
}

export async function reorderReadingQueue(bookIds: number[]): Promise<ReadingQueueResponse> {
  const res = await api('/api/v1/reading-queue/reorder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookIds }),
  })
  if (!res.ok) throw new Error('Failed to reorder reading queue')
  return res.json()
}

export async function fetchReadingQueueView(): Promise<ReadingQueueView> {
  const res = await api('/api/v1/user-preferences/reading-queue')
  if (!res.ok) throw new Error('Failed to fetch reading queue view')
  const data: { settings: { view: ReadingQueueView } } = await res.json()
  return data.settings.view
}

export async function saveReadingQueueView(view: ReadingQueueView): Promise<void> {
  const res = await api('/api/v1/user-preferences/reading-queue', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: { view } }),
  })
  if (!res.ok) throw new Error('Failed to save reading queue view')
}
