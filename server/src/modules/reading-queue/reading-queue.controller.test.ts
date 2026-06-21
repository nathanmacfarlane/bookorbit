import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReadingQueueController } from './reading-queue.controller';

const user = { id: 42, isSuperuser: false } as never;

describe('ReadingQueueController', () => {
  let service: { getQueue: any; addBook: any; removeBook: any; reorder: any };
  let controller: ReadingQueueController;

  beforeEach(() => {
    service = {
      getQueue: vi.fn().mockResolvedValue({ items: [] }),
      addBook: vi.fn().mockResolvedValue({ items: [] }),
      removeBook: vi.fn().mockResolvedValue({ items: [] }),
      reorder: vi.fn().mockResolvedValue({ items: [] }),
    };
    controller = new ReadingQueueController(service as never);
  });

  it('GET delegates to service.getQueue', async () => {
    await controller.findAll(user);
    expect(service.getQueue).toHaveBeenCalledWith(user);
  });

  it('POST delegates the bookId to service.addBook', async () => {
    await controller.add({ bookId: 7 }, user);
    expect(service.addBook).toHaveBeenCalledWith(user, 7);
  });

  it('DELETE delegates the bookId param to service.removeBook', async () => {
    await controller.remove(7, user);
    expect(service.removeBook).toHaveBeenCalledWith(user, 7);
  });

  it('PUT reorder delegates ordered ids to service.reorder', async () => {
    await controller.reorder({ bookIds: [3, 1, 2] }, user);
    expect(service.reorder).toHaveBeenCalledWith(user, [3, 1, 2]);
  });
});
