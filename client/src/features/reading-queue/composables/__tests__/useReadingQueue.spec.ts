import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('../../api/reading-queue.api', () => ({
  fetchReadingQueue: vi.fn(),
  addToReadingQueue: vi.fn(),
  removeFromReadingQueue: vi.fn(),
  reorderReadingQueue: vi.fn(),
}))

import * as apiMod from '../../api/reading-queue.api'
import { useReadingQueue } from '../useReadingQueue'

const mockFetchReadingQueue = vi.mocked(apiMod.fetchReadingQueue)
const mockReorderReadingQueue = vi.mocked(apiMod.reorderReadingQueue)
const mockRemoveFromReadingQueue = vi.mocked(apiMod.removeFromReadingQueue)

const item = (id: number, position: number) => ({ position, book: { id, title: `B${id}` } as never })

describe('useReadingQueue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('load populates items', async () => {
    mockFetchReadingQueue.mockResolvedValue({ items: [item(7, 1), item(3, 2)] })
    const q = useReadingQueue()
    await q.load()
    expect(q.items.value.map((i) => i.book.id)).toEqual([7, 3])
  })

  it('applyReorder updates optimistically then persists ordered ids', async () => {
    mockFetchReadingQueue.mockResolvedValue({ items: [item(1, 1), item(2, 2), item(3, 3)] })
    mockReorderReadingQueue.mockResolvedValue({ items: [item(3, 1), item(1, 2), item(2, 3)] })
    const q = useReadingQueue()
    await q.load()
    await q.applyReorder([item(3, 1), item(1, 2), item(2, 3)] as never)
    expect(apiMod.reorderReadingQueue).toHaveBeenCalledWith([3, 1, 2])
    expect(q.items.value.map((i) => i.book.id)).toEqual([3, 1, 2])
  })

  it('applyReorder reverts on error', async () => {
    mockFetchReadingQueue.mockResolvedValue({ items: [item(1, 1), item(2, 2)] })
    mockReorderReadingQueue.mockRejectedValue(new Error('nope'))
    const q = useReadingQueue()
    await q.load()
    await q.applyReorder([item(2, 1), item(1, 2)] as never)
    expect(q.items.value.map((i) => i.book.id)).toEqual([1, 2])
  })

  it('remove drops the item and calls the api', async () => {
    mockFetchReadingQueue.mockResolvedValue({ items: [item(1, 1), item(2, 2)] })
    mockRemoveFromReadingQueue.mockResolvedValue({ items: [item(2, 1)] })
    const q = useReadingQueue()
    await q.load()
    await q.remove(1)
    expect(apiMod.removeFromReadingQueue).toHaveBeenCalledWith(1)
    expect(q.items.value.map((i) => i.book.id)).toEqual([2])
  })
})
