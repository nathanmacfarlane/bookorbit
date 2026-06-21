import type { BookCard } from './book';

export const READING_QUEUE_VIEWS = ['grid', 'list'] as const;
export type ReadingQueueView = (typeof READING_QUEUE_VIEWS)[number];

/** One queue entry: position plus the hydrated book card for rendering. */
export type ReadingQueueItem = {
  position: number;
  book: BookCard;
};

export type ReadingQueueResponse = {
  items: ReadingQueueItem[];
};

export type AddReadingQueueItemRequest = {
  bookId: number;
};

export type ReorderReadingQueueRequest = {
  /** Full ordered list of the user's queued book ids, in the desired order. */
  bookIds: number[];
};

export type ReadingQueueViewPreference = {
  view: ReadingQueueView;
};
