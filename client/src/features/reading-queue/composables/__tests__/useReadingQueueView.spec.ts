import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReadingQueueView } from '@bookorbit/types'

vi.mock('../../api/reading-queue.api', () => ({
  fetchReadingQueueView: vi.fn<() => Promise<ReadingQueueView>>(),
  saveReadingQueueView: vi.fn<(view: ReadingQueueView) => Promise<void>>(),
}))

import * as apiMod from '../../api/reading-queue.api'
import { useReadingQueueView } from '../useReadingQueueView'

const mockFetchReadingQueueView = vi.mocked(apiMod.fetchReadingQueueView)
const mockSaveReadingQueueView = vi.mocked(apiMod.saveReadingQueueView)

describe('useReadingQueueView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults to grid before load', () => {
    const v = useReadingQueueView()
    expect(v.view.value).toBe('grid')
  })

  it('load applies the persisted view', async () => {
    mockFetchReadingQueueView.mockResolvedValue('list')
    const v = useReadingQueueView()
    await v.load()
    expect(v.view.value).toBe('list')
  })

  it('setView updates immediately and persists', async () => {
    mockSaveReadingQueueView.mockResolvedValue(undefined)
    const v = useReadingQueueView()
    await v.setView('list')
    expect(v.view.value).toBe('list')
    expect(apiMod.saveReadingQueueView).toHaveBeenCalledWith('list')
  })
})
