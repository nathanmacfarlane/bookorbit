import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, lte, max, min, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { BookReadingSession, BookReadingSessionListResponse, BookReadingSessionStats } from '@bookorbit/types';
import { DB } from '../../db';
import * as schema from '../../db/schema';
import { bookFiles, books, readingSessions, userReadingDailyStats } from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

const MIN_READING_SESSION_SECONDS = 10;

export type SaveReadingSessionResult =
  | { kind: 'saved' }
  | {
      kind: 'skipped';
      reason: 'duration_below_minimum' | 'book_file_not_found' | 'duplicate_session_id';
    };

@Injectable()
export class ReadingSessionRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async saveSession(
    userId: number,
    bookFileId: number,
    sessionId: string,
    startedAt: Date,
    endedAt: Date,
    durationSeconds: number,
    progressDelta: number | null,
    endProgress: number | null,
  ): Promise<SaveReadingSessionResult> {
    if (durationSeconds < MIN_READING_SESSION_SECONDS) {
      return { kind: 'skipped', reason: 'duration_below_minimum' };
    }

    const [fileRow] = await this.db
      .select({ libraryId: books.libraryId })
      .from(bookFiles)
      .innerJoin(books, eq(books.id, bookFiles.bookId))
      .where(eq(bookFiles.id, bookFileId))
      .limit(1);

    if (!fileRow) {
      return { kind: 'skipped', reason: 'book_file_not_found' };
    }

    const { libraryId } = fileRow;

    return this.db.transaction(async (tx): Promise<SaveReadingSessionResult> => {
      const inserted = await tx
        .insert(readingSessions)
        .values({ userId, bookFileId, sessionId, startedAt, endedAt, durationSeconds, progressDelta, endProgress })
        .onConflictDoNothing({ target: [readingSessions.userId, readingSessions.sessionId] })
        .returning({ id: readingSessions.id });

      if (inserted.length === 0) {
        return { kind: 'skipped', reason: 'duplicate_session_id' };
      }

      await tx
        .insert(userReadingDailyStats)
        .values({
          userId,
          libraryId,
          day: sql<string>`date_trunc('day', ${startedAt}::timestamp)::date`,
          readingSeconds: durationSeconds,
          progressDelta: progressDelta ?? 0,
          sessionsCount: 1,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userReadingDailyStats.userId, userReadingDailyStats.libraryId, userReadingDailyStats.day],
          set: {
            readingSeconds: sql`${userReadingDailyStats.readingSeconds} + ${durationSeconds}`,
            progressDelta: sql`${userReadingDailyStats.progressDelta} + ${progressDelta ?? 0}`,
            sessionsCount: sql`${userReadingDailyStats.sessionsCount} + 1`,
            updatedAt: new Date(),
          },
        });

      return { kind: 'saved' };
    });
  }

  async listByBook(
    userId: number,
    bookId: number,
    page: number,
    pageSize: number,
    sortBy: string,
    sortDir: string,
    dateFrom?: string,
    dateTo?: string,
    format?: string,
  ): Promise<BookReadingSessionListResponse> {
    const conditions = [eq(books.id, bookId), eq(readingSessions.userId, userId)];
    if (dateFrom) conditions.push(gte(readingSessions.startedAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(readingSessions.startedAt, new Date(dateTo)));
    if (format) conditions.push(eq(sql`upper(${bookFiles.format})`, format.toUpperCase()));

    const whereClause = and(...conditions);

    let orderCol;
    switch (sortBy) {
      case 'durationSeconds':
        orderCol = readingSessions.durationSeconds;
        break;
      case 'progressDelta':
        orderCol = readingSessions.progressDelta;
        break;
      case 'endProgress':
        orderCol = readingSessions.endProgress;
        break;
      default:
        orderCol = readingSessions.startedAt;
    }
    const orderExpr = sortDir === 'asc' ? asc(orderCol) : desc(orderCol);
    const offset = (page - 1) * pageSize;

    const [rows, countRows, statsRows, dailyRows] = await Promise.all([
      this.db
        .select({
          id: readingSessions.id,
          startedAt: readingSessions.startedAt,
          endedAt: readingSessions.endedAt,
          durationSeconds: readingSessions.durationSeconds,
          progressDelta: readingSessions.progressDelta,
          endProgress: readingSessions.endProgress,
          format: sql<string | null>`nullif(${bookFiles.format}, '')`,
        })
        .from(readingSessions)
        .innerJoin(bookFiles, eq(bookFiles.id, readingSessions.bookFileId))
        .innerJoin(books, eq(books.id, bookFiles.bookId))
        .where(whereClause)
        .orderBy(orderExpr)
        .limit(pageSize)
        .offset(offset),

      this.db
        .select({ total: count() })
        .from(readingSessions)
        .innerJoin(bookFiles, eq(bookFiles.id, readingSessions.bookFileId))
        .innerJoin(books, eq(books.id, bookFiles.bookId))
        .where(whereClause),

      this.db
        .select({
          totalSessions: count(),
          totalSeconds: sql<number>`coalesce(sum(${readingSessions.durationSeconds}), 0)::int`,
          avgDurationSeconds: sql<number>`coalesce(avg(${readingSessions.durationSeconds}), 0)::int`,
          firstSessionAt: min(readingSessions.startedAt),
          lastSessionAt: max(readingSessions.startedAt),
        })
        .from(readingSessions)
        .innerJoin(bookFiles, eq(bookFiles.id, readingSessions.bookFileId))
        .innerJoin(books, eq(books.id, bookFiles.bookId))
        .where(whereClause),

      this.db
        .select({
          day: sql<string>`date_trunc('day', ${readingSessions.startedAt})::date::text`,
          totalMinutes: sql<number>`round(sum(${readingSessions.durationSeconds}) / 60.0, 1)::real`,
        })
        .from(readingSessions)
        .innerJoin(bookFiles, eq(bookFiles.id, readingSessions.bookFileId))
        .innerJoin(books, eq(books.id, bookFiles.bookId))
        .where(whereClause)
        .groupBy(sql`date_trunc('day', ${readingSessions.startedAt})::date`)
        .orderBy(asc(sql`date_trunc('day', ${readingSessions.startedAt})::date`)),
    ]);

    const total = countRows[0]?.total ?? 0;
    const statsRow = statsRows[0];

    const stats: BookReadingSessionStats = {
      totalSessions: statsRow?.totalSessions ?? 0,
      totalSeconds: statsRow?.totalSeconds ?? 0,
      avgDurationSeconds: statsRow?.avgDurationSeconds ?? 0,
      firstSessionAt: statsRow?.firstSessionAt ? (statsRow.firstSessionAt as Date).toISOString() : null,
      lastSessionAt: statsRow?.lastSessionAt ? (statsRow.lastSessionAt as Date).toISOString() : null,
      dailySummary: dailyRows.map((r) => ({ day: r.day, totalMinutes: r.totalMinutes })),
    };

    const items: BookReadingSession[] = rows.map((r) => ({
      id: r.id,
      startedAt: (r.startedAt as Date).toISOString(),
      endedAt: (r.endedAt as Date).toISOString(),
      durationSeconds: r.durationSeconds,
      progressDelta: r.progressDelta ?? null,
      endProgress: r.endProgress ?? null,
      format: r.format ?? null,
    }));

    return { items, total, page, pageSize, stats };
  }

  async deleteSessionByBook(userId: number, bookId: number, sessionId: number): Promise<{ found: boolean }> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          id: readingSessions.id,
          startedAt: readingSessions.startedAt,
          durationSeconds: readingSessions.durationSeconds,
          progressDelta: readingSessions.progressDelta,
          libraryId: books.libraryId,
        })
        .from(readingSessions)
        .innerJoin(bookFiles, eq(bookFiles.id, readingSessions.bookFileId))
        .innerJoin(books, eq(books.id, bookFiles.bookId))
        .where(and(eq(readingSessions.id, sessionId), eq(readingSessions.userId, userId), eq(books.id, bookId)))
        .limit(1);

      if (!row) return { found: false };

      const { startedAt, durationSeconds, progressDelta, libraryId } = row;

      await tx.delete(readingSessions).where(eq(readingSessions.id, sessionId));

      const dayKey = this.formatDayKey(startedAt as Date);

      // Subtract this session's contribution from daily stats rather than deleting and
      // rebuilding, so that KoReader-sourced reading time (stored directly in
      // userReadingDailyStats without a reading_sessions row) is preserved.
      await tx
        .update(userReadingDailyStats)
        .set({
          readingSeconds: sql`greatest(${userReadingDailyStats.readingSeconds} - ${durationSeconds}, 0)`,
          progressDelta: sql`greatest(${userReadingDailyStats.progressDelta} - ${progressDelta ?? 0}, 0)`,
          sessionsCount: sql`greatest(${userReadingDailyStats.sessionsCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(and(eq(userReadingDailyStats.userId, userId), eq(userReadingDailyStats.libraryId, libraryId), eq(userReadingDailyStats.day, dayKey)));

      return { found: true };
    });
  }

  private formatDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
