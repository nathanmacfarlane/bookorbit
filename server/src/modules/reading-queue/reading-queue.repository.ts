import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, eq, max, sql } from 'drizzle-orm';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import { readingQueueItems } from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class ReadingQueueRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findOrderedBookIds(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ bookId: readingQueueItems.bookId })
      .from(readingQueueItems)
      .where(eq(readingQueueItems.userId, userId))
      .orderBy(asc(readingQueueItems.position));
    return rows.map((r) => r.bookId);
  }

  async getMaxPosition(userId: number): Promise<number> {
    const rows = await this.db
      .select({ max: max(readingQueueItems.position) })
      .from(readingQueueItems)
      .where(eq(readingQueueItems.userId, userId));
    return rows[0]?.max ?? 0;
  }

  async insertAtEnd(userId: number, bookId: number, position: number): Promise<void> {
    await this.db
      .insert(readingQueueItems)
      .values({ userId, bookId, position })
      .onConflictDoNothing({ target: [readingQueueItems.userId, readingQueueItems.bookId] });
  }

  async remove(userId: number, bookId: number): Promise<void> {
    await this.db.delete(readingQueueItems).where(and(eq(readingQueueItems.userId, userId), eq(readingQueueItems.bookId, bookId)));
  }

  /** Rewrite positions for the given ordered ids in a single transaction. */
  async reorder(userId: number, orderedBookIds: number[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < orderedBookIds.length; i++) {
        await tx
          .update(readingQueueItems)
          .set({ position: i + 1 })
          .where(and(eq(readingQueueItems.userId, userId), eq(readingQueueItems.bookId, orderedBookIds[i]!)));
      }
    });
  }

  /** Compact positions to be contiguous 1..n after a removal. */
  async compactPositions(userId: number): Promise<void> {
    await this.db.execute(sql`
      with ordered as (
        select id, row_number() over (order by position) as rn
        from reading_queue_items
        where user_id = ${userId}
      )
      update reading_queue_items q
      set position = ordered.rn
      from ordered
      where q.id = ordered.id
    `);
  }
}
