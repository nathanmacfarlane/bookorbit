import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { BookCard, ReadingQueueResponse } from '@bookorbit/types';
import type { RequestUser } from '../../common/types/request-user';
import { BookReadService } from '../book/book-read.service';
import { assembleBookCards } from '../book/utils/assemble-book-cards';
import { LibraryService } from '../library/library.service';
import { ReadingQueueRepository } from './reading-queue.repository';

const BOOK_NOT_FOUND = 'Book not found or not accessible';
const QUEUE_MISMATCH = 'Provided book ids do not match the current queue';

@Injectable()
export class ReadingQueueService {
  constructor(
    private readonly repo: ReadingQueueRepository,
    private readonly bookRead: BookReadService,
    private readonly library: LibraryService,
  ) {}

  async getQueue(user: RequestUser): Promise<ReadingQueueResponse> {
    const orderedIds = await this.repo.findOrderedBookIds(user.id);
    return this.hydrate(user, orderedIds);
  }

  async addBook(user: RequestUser, bookId: number): Promise<ReadingQueueResponse> {
    await this.assertBookAccessible(user, bookId);
    const max = await this.repo.getMaxPosition(user.id);
    await this.repo.insertAtEnd(user.id, bookId, max + 1);
    return this.getQueue(user);
  }

  async removeBook(user: RequestUser, bookId: number): Promise<ReadingQueueResponse> {
    await this.repo.remove(user.id, bookId);
    await this.repo.compactPositions(user.id);
    return this.getQueue(user);
  }

  async reorder(user: RequestUser, bookIds: number[]): Promise<ReadingQueueResponse> {
    const current = await this.repo.findOrderedBookIds(user.id);
    if (!sameSet(current, bookIds)) {
      throw new BadRequestException(QUEUE_MISMATCH);
    }
    await this.repo.reorder(user.id, bookIds);
    return this.getQueue(user);
  }

  private async assertBookAccessible(user: RequestUser, bookId: number): Promise<void> {
    // findLibraryIdByBookId returns Promise<number | null>
    const libraryId = await this.bookRead.findLibraryIdByBookId(bookId);
    if (libraryId == null) throw new NotFoundException(BOOK_NOT_FOUND);
    // findAccessibleLibraryIds handles superuser logic internally
    const accessible = await this.library.findAccessibleLibraryIds(user);
    if (!accessible.includes(libraryId)) throw new NotFoundException(BOOK_NOT_FOUND);
  }

  private async hydrate(user: RequestUser, orderedIds: number[]): Promise<ReadingQueueResponse> {
    if (orderedIds.length === 0) return { items: [] };
    const { rows, authorRows, fileRows, genreRows, progressRows, statusRows, narratorRows, tagRows, seriesMembershipRows } =
      await this.bookRead.findCardsByBookIds(orderedIds, user.id);
    const cards = assembleBookCards(rows, authorRows, fileRows, genreRows, progressRows, statusRows, narratorRows, tagRows, seriesMembershipRows);
    const byId = new Map(cards.map((c: BookCard) => [c.id, c]));
    const items: { position: number; book: BookCard }[] = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const book = byId.get(orderedIds[i]);
      if (book) items.push({ position: i + 1, book });
    }
    return { items };
  }
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((id) => setA.has(id));
}
