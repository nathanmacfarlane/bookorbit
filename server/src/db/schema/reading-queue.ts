import { index, integer, pgTable, serial, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { books } from './books';
import { users } from './auth';

export const readingQueueItems = pgTable(
  'reading_queue_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('reading_queue_items_user_book_uidx').on(t.userId, t.bookId),
    index('reading_queue_items_user_position_idx').on(t.userId, t.position),
  ],
);

export type ReadingQueueItemRow = typeof readingQueueItems.$inferSelect;
export type NewReadingQueueItemRow = typeof readingQueueItems.$inferInsert;
