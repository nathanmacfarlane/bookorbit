import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingQueueRepository } from './reading-queue.repository';

function makeDb() {
  const db: any = {};
  db.select = vi.fn(() => db);
  db.from = vi.fn(() => db);
  db.where = vi.fn(() => db);
  db.orderBy = vi.fn(() => db);
  db.insert = vi.fn(() => db);
  db.values = vi.fn(() => db);
  db.onConflictDoNothing = vi.fn(() => db);
  db.returning = vi.fn(() => Promise.resolve([]));
  db.delete = vi.fn(() => db);
  db.update = vi.fn(() => db);
  db.set = vi.fn(() => db);
  db.transaction = vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(db));
  db.execute = vi.fn(() => Promise.resolve());
  return db;
}

describe('ReadingQueueRepository', () => {
  let db: ReturnType<typeof makeDb>;
  let repo: ReadingQueueRepository;

  beforeEach(() => {
    db = makeDb();
    repo = new ReadingQueueRepository(db as never);
  });

  it('findOrderedBookIds selects book ids for the user ordered by position', async () => {
    db.orderBy = vi.fn(() => Promise.resolve([{ bookId: 7 }, { bookId: 3 }]));
    const ids = await repo.findOrderedBookIds(42);
    expect(ids).toEqual([7, 3]);
    expect(db.select).toHaveBeenCalled();
  });

  it('getMaxPosition returns 0 when the queue is empty', async () => {
    db.where = vi.fn(() => Promise.resolve([{ max: null }]));
    const max = await repo.getMaxPosition(42);
    expect(max).toBe(0);
  });

  it('getMaxPosition returns the current max position', async () => {
    db.where = vi.fn(() => Promise.resolve([{ max: 5 }]));
    const max = await repo.getMaxPosition(42);
    expect(max).toBe(5);
  });

  it('insertAtEnd inserts with the given position and ignores duplicates', async () => {
    await repo.insertAtEnd(42, 7, 6);
    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalledWith({ userId: 42, bookId: 7, position: 6 });
    expect(db.onConflictDoNothing).toHaveBeenCalled();
  });

  it('remove deletes the row for the user+book', async () => {
    db.where = vi.fn(() => Promise.resolve(undefined));
    await repo.remove(42, 7);
    expect(db.delete).toHaveBeenCalled();
  });
});
