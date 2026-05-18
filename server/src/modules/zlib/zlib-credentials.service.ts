import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db/db.module';
import * as schema from '../../db/schema';
import { zlibCredentials } from '../../db/schema/zlib';

type Db = NodePgDatabase<typeof schema>;

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

@Injectable()
export class ZlibCredentialsService {
  private readonly logger = new Logger(ZlibCredentialsService.name);
  private readonly key: Buffer | null;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('zlib.encryptionKey') ?? '';
    if (raw.length === 64) {
      this.key = Buffer.from(raw, 'hex');
    } else {
      if (raw.length > 0) {
        this.logger.warn('ZLIB_ENCRYPTION_KEY must be a 64-char hex string. Z-Library keys will be stored unencrypted.');
      }
      this.key = null;
    }
  }

  async upsert(userId: number, email: string, remixUserId: string, remixUserKey: string): Promise<void> {
    const encryptedKey = this.encrypt(remixUserKey);
    const existing = await this.db.select({ id: zlibCredentials.id }).from(zlibCredentials).where(eq(zlibCredentials.userId, userId)).limit(1);

    if (existing.length > 0) {
      await this.db
        .update(zlibCredentials)
        .set({ email, remixUserId, remixUserKey: encryptedKey, updatedAt: new Date() })
        .where(eq(zlibCredentials.userId, userId));
    } else {
      await this.db.insert(zlibCredentials).values({ userId, email, remixUserId, remixUserKey: encryptedKey });
    }
  }

  async findByUserId(userId: number): Promise<{ email: string; remixUserId: string; remixUserKey: string } | null> {
    const rows = await this.db.select().from(zlibCredentials).where(eq(zlibCredentials.userId, userId)).limit(1);
    const row = rows[0];
    if (!row) return null;

    return {
      email: row.email,
      remixUserId: row.remixUserId,
      remixUserKey: this.decrypt(row.remixUserKey),
    };
  }

  async deleteByUserId(userId: number): Promise<void> {
    const result = await this.db.delete(zlibCredentials).where(eq(zlibCredentials.userId, userId)).returning({ id: zlibCredentials.id });
    if (result.length === 0) {
      throw new NotFoundException('Z-Library credentials not found');
    }
  }

  private encrypt(plaintext: string): string {
    if (!this.key) return plaintext;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(ciphertext: string): string {
    if (!this.key) return ciphertext;
    try {
      const buf = Buffer.from(ciphertext, 'base64');
      const iv = buf.subarray(0, IV_LENGTH);
      const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      this.logger.warn('Failed to decrypt Z-Library key — returning as-is');
      return ciphertext;
    }
  }
}
