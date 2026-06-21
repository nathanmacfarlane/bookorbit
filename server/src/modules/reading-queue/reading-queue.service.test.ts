import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock assembleBookCards to pass rows through as-is, so tests stay simple
vi.mock('../book/utils/assemble-book-cards', () => ({
  assembleBookCards: vi.fn((rows: { id: number }[]) => rows),
}));

import { ReadingQueueService } from './reading-queue.service';

const user = { id: 42, isSuperuser: false } as never;

/** Build a raw findCardsByBookIds result from a simple array of partial cards. */
function cardResult(cards: { id: number; title?: string }[]) {
  return {
    rows: cards,
    authorRows: [],
    fileRows: [],
    genreRows: [],
    progressRows: [],
    statusRows: [],
    narratorRows: [],
    tagRows: [],
    seriesMembershipRows: [],
    total: cards.length,
  };
}

function makeDeps() {
  const repo = {
    findOrderedBookIds: vi.fn(),
    getMaxPosition: vi.fn(),
    insertAtEnd: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
    compactPositions: vi.fn(),
  };
  const bookRead = {
    findCardsByBookIds: vi.fn(),
    findLibraryIdByBookId: vi.fn(),
  };
  const library = {
    findAccessibleLibraryIds: vi.fn(), // real method: findAccessibleLibraryIds(user: RequestUser): Promise<number[]>
  };
  return { repo, bookRead, library };
}

describe('ReadingQueueService', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: ReadingQueueService;

  beforeEach(() => {
    deps = makeDeps();
    service = new ReadingQueueService(deps.repo as never, deps.bookRead as never, deps.library as never);
  });

  it('getQueue returns items ordered by queue position, hydrated with cards', async () => {
    deps.repo.findOrderedBookIds.mockResolvedValue([7, 3]);
    deps.bookRead.findCardsByBookIds.mockResolvedValue(
      cardResult([
        { id: 3, title: 'B' },
        { id: 7, title: 'A' },
      ]),
    );
    const result = await service.getQueue(user);
    expect(result.items.map((i) => i.book.id)).toEqual([7, 3]);
    expect(result.items.map((i) => i.position)).toEqual([1, 2]);
  });

  it('getQueue returns empty items when queue is empty', async () => {
    deps.repo.findOrderedBookIds.mockResolvedValue([]);
    const result = await service.getQueue(user);
    expect(result.items).toEqual([]);
    expect(deps.bookRead.findCardsByBookIds).not.toHaveBeenCalled();
  });

  it('addBook rejects a book the user cannot access', async () => {
    // findLibraryIdByBookId returns number | null — libraryId 99 is not in accessible list
    deps.bookRead.findLibraryIdByBookId.mockResolvedValue(99);
    deps.library.findAccessibleLibraryIds.mockResolvedValue([1, 2]);
    await expect(service.addBook(user, 7)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.repo.insertAtEnd).not.toHaveBeenCalled();
  });

  it('addBook appends at max+1 for an accessible book', async () => {
    deps.bookRead.findLibraryIdByBookId.mockResolvedValue(1);
    deps.library.findAccessibleLibraryIds.mockResolvedValue([1, 2]);
    deps.repo.getMaxPosition.mockResolvedValue(4);
    deps.repo.findOrderedBookIds.mockResolvedValue([1, 2, 7]);
    deps.bookRead.findCardsByBookIds.mockResolvedValue(cardResult([{ id: 1 }, { id: 2 }, { id: 7 }]));
    await service.addBook(user, 7);
    expect(deps.repo.insertAtEnd).toHaveBeenCalledWith(42, 7, 5);
  });

  it('removeBook deletes then compacts positions', async () => {
    deps.repo.findOrderedBookIds.mockResolvedValue([]);
    await service.removeBook(user, 7);
    expect(deps.repo.remove).toHaveBeenCalledWith(42, 7);
    expect(deps.repo.compactPositions).toHaveBeenCalledWith(42);
  });

  it('reorder rejects when the id set does not match current membership', async () => {
    deps.repo.findOrderedBookIds.mockResolvedValue([1, 2, 3]);
    await expect(service.reorder(user, [1, 2])).rejects.toBeInstanceOf(BadRequestException);
    expect(deps.repo.reorder).not.toHaveBeenCalled();
  });

  it('reorder persists the new order when membership matches', async () => {
    deps.repo.findOrderedBookIds.mockResolvedValueOnce([1, 2, 3]).mockResolvedValueOnce([3, 1, 2]);
    deps.bookRead.findCardsByBookIds.mockResolvedValue(cardResult([{ id: 1 }, { id: 2 }, { id: 3 }]));
    await service.reorder(user, [3, 1, 2]);
    expect(deps.repo.reorder).toHaveBeenCalledWith(42, [3, 1, 2]);
  });
});
