import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db/db.module';
import * as schema from '../../db/schema';
import { zlibDownloadQueue } from '../../db/schema/zlib';
import { BookDockIngestService } from '../book-dock/book-dock-ingest.service';
import { ZlibApiService } from './zlib-api.service';
import { ZlibCredentialsService } from './zlib-credentials.service';
import { ZlibLimitReachedException } from './zlib-limit.exception';

type Db = NodePgDatabase<typeof schema>;

const DAILY_LIMIT = 10;

@Injectable()
export class ZlibQueueService {
  private readonly logger = new Logger(ZlibQueueService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly zlibApi: ZlibApiService,
    private readonly credentials: ZlibCredentialsService,
    private readonly bookDockIngest: BookDockIngestService,
  ) {}

  // -------------------------------------------------------------------------
  // Queue CRUD
  // -------------------------------------------------------------------------

  async addToQueue(
    userId: number,
    bookId: string,
    hash: string,
    title: string,
    author: string,
    extension: string,
    cover: string | null,
  ): Promise<ZlibDownloadQueueItem> {
    const safeName = title.replace(/[^\w\s.-]/g, '').trim() || 'book';
    const filename = `${safeName}.${extension || 'epub'}`;

    const [item] = await this.db
      .insert(zlibDownloadQueue)
      .values({ userId, zlibBookId: bookId, hash, title, author, extension: extension || 'epub', filename, cover, status: 'pending' })
      .returning();
    return item;
  }

  async removeFromQueue(userId: number, itemId: number): Promise<void> {
    await this.db.delete(zlibDownloadQueue).where(and(eq(zlibDownloadQueue.id, itemId), eq(zlibDownloadQueue.userId, userId)));
  }

  async getQueue(userId: number): Promise<ZlibDownloadQueueItemWithPosition[]> {
    const rows = await this.db.select().from(zlibDownloadQueue).where(eq(zlibDownloadQueue.userId, userId)).orderBy(asc(zlibDownloadQueue.createdAt));

    // Assign position numbers to pending items
    let pendingPos = 0;
    return rows.map((row) => ({
      ...row,
      queuePosition: row.status === 'pending' ? ++pendingPos : null,
    }));
  }

  async retryFailed(userId: number, itemId: number): Promise<void> {
    await this.db
      .update(zlibDownloadQueue)
      .set({ status: 'pending', errorMessage: null, processedAt: null })
      .where(and(eq(zlibDownloadQueue.id, itemId), eq(zlibDownloadQueue.userId, userId), eq(zlibDownloadQueue.status, 'failed')));
  }

  // -------------------------------------------------------------------------
  // Cron drain — runs every 30 minutes, processes users whose limit has reset
  // -------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_30_MINUTES)
  async drainQueues(): Promise<void> {
    // Find all distinct userIds with pending queue items
    const pendingUsers = await this.db
      .selectDistinct({ userId: zlibDownloadQueue.userId })
      .from(zlibDownloadQueue)
      .where(eq(zlibDownloadQueue.status, 'pending'));

    if (pendingUsers.length === 0) return;

    this.logger.log(`[queue] Checking ${pendingUsers.length} user(s) with pending items`);

    for (const { userId } of pendingUsers) {
      try {
        await this.drainForUser(userId);
      } catch (err) {
        this.logger.error(`[queue] Unhandled error draining queue for userId=${userId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  async drainForUser(userId: number): Promise<void> {
    const creds = await this.credentials.findByUserId(userId);
    if (!creds) return;

    // Always clear our internal limit flag and counter before attempting —
    // Z-Library resets on a fixed daily schedule (not 24h from when we hit the
    // limit), so we let Z-Lib's actual response be the source of truth.
    if (creds.limitHitAt) {
      await this.credentials.resetCountIfExpired(userId, true);
      this.logger.log(`[queue] userId=${userId} clearing internal limit flag, will let Z-Lib decide`);
    }

    // Re-fetch after potential reset
    const freshCreds = await this.credentials.findByUserId(userId);
    if (!freshCreds) return;

    const remaining = DAILY_LIMIT - (freshCreds.dailyDownloadCount ?? 0);
    if (remaining <= 0) return;

    // Get oldest pending items up to remaining quota
    const items = await this.db
      .select()
      .from(zlibDownloadQueue)
      .where(and(eq(zlibDownloadQueue.userId, userId), eq(zlibDownloadQueue.status, 'pending')))
      .orderBy(asc(zlibDownloadQueue.createdAt))
      .limit(remaining);

    if (items.length === 0) return;

    this.logger.log(`[queue] userId=${userId} draining ${items.length} item(s), ${remaining} downloads remaining today`);

    for (const item of items) {
      const success = await this.downloadQueueItem(userId, item, freshCreds);
      if (!success) break; // limit hit mid-drain — stop
    }
  }

  private async downloadQueueItem(
    userId: number,
    item: ZlibDownloadQueueItem,
    creds: { remixUserId: string; remixUserKey: string; sessionCookies: string },
  ): Promise<boolean> {
    // Mark as processing
    await this.db.update(zlibDownloadQueue).set({ status: 'processing' }).where(eq(zlibDownloadQueue.id, item.id));

    try {
      const { stream, filename } = await this.zlibApi.downloadStream(
        creds.remixUserId,
        creds.remixUserKey,
        creds.sessionCookies,
        item.zlibBookId,
        item.hash,
      );

      const resolvedFilename = item.filename || filename;
      const bookDockId = await this.bookDockIngest.ingestUpload(resolvedFilename, stream, userId);

      await this.credentials.incrementDownloadCount(userId);
      await this.db
        .update(zlibDownloadQueue)
        .set({ status: 'completed', bookDockId, processedAt: new Date() })
        .where(eq(zlibDownloadQueue.id, item.id));

      this.logger.log(`[queue] userId=${userId} itemId=${item.id} downloaded "${item.title}" → bookDockId=${bookDockId}`);
      return true;
    } catch (err) {
      if (err instanceof ZlibLimitReachedException) {
        await this.credentials.markLimitHit(userId);
        await this.db
          .update(zlibDownloadQueue)
          .set({ status: 'pending' }) // put back to pending, will retry after reset
          .where(eq(zlibDownloadQueue.id, item.id));
        this.logger.warn(`[queue] userId=${userId} daily limit reached mid-drain`);
        return false;
      }

      const message = err instanceof Error ? err.message : String(err);
      await this.db
        .update(zlibDownloadQueue)
        .set({ status: 'failed', errorMessage: message, processedAt: new Date() })
        .where(eq(zlibDownloadQueue.id, item.id));
      this.logger.warn(`[queue] userId=${userId} itemId=${item.id} failed: ${message}`);
      return true; // failed but not a limit error — continue with next item
    }
  }
}

// Type alias used internally
type ZlibDownloadQueueItem = typeof zlibDownloadQueue.$inferSelect;
type ZlibDownloadQueueItemWithPosition = ZlibDownloadQueueItem & { queuePosition: number | null };
