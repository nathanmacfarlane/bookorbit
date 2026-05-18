import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Permission } from '@bookorbit/types';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db/db.module';
import * as schema from '../../db/schema';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { ZlibConnectDto } from './dto/zlib-connect.dto';
import { ZlibDownloadDto } from './dto/zlib-download.dto';
import { ZlibSearchDto } from './dto/zlib-search.dto';
import { ZlibApiService } from './zlib-api.service';
import { ZlibCredentialsService } from './zlib-credentials.service';
import { BookDockIngestService } from '../book-dock/book-dock-ingest.service';

type Db = NodePgDatabase<typeof schema>;

@Controller('zlib')
export class ZlibController {
  constructor(
    private readonly zlibApi: ZlibApiService,
    private readonly credentials: ZlibCredentialsService,
    private readonly bookDockIngest: BookDockIngestService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get('debug')
  @Public()
  async debug() {
    const result = await this.db.execute(sql`
      SELECT
        current_database() as db,
        EXISTS (
          SELECT FROM information_schema.tables WHERE table_name = 'zlib_credentials'
        ) as table_exists,
        (SELECT COUNT(*) FROM __drizzle_migrations WHERE tag LIKE '%zlib%') as zlib_migrations
    `);
    return result.rows[0];
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(@Body() dto: ZlibConnectDto, @CurrentUser() user: RequestUser) {
    const result = await this.zlibApi.login(dto.email, dto.password);
    await this.credentials.upsert(user.id, result.email, result.remixUserId, result.remixUserKey);
    return { connected: true, email: result.email };
  }

  @Delete('connect')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: RequestUser) {
    await this.credentials.deleteByUserId(user.id);
  }

  @Get('status')
  async status(@CurrentUser() user: RequestUser) {
    const creds = await this.credentials.findByUserId(user.id);
    if (!creds) return { connected: false };
    return { connected: true, email: creds.email };
  }

  @Get('search')
  @RequirePermission(Permission.LibraryUpload)
  async search(@Query() dto: ZlibSearchDto, @CurrentUser() user: RequestUser) {
    const creds = await this.credentials.findByUserId(user.id);
    if (!creds) throw new UnauthorizedException('Z-Library not connected');
    return this.zlibApi.search(creds.remixUserId, creds.remixUserKey, dto.q, dto.format, dto.limit);
  }

  @Post('download')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(Permission.LibraryUpload)
  async download(@Body() dto: ZlibDownloadDto, @CurrentUser() user: RequestUser) {
    const creds = await this.credentials.findByUserId(user.id);
    if (!creds) throw new UnauthorizedException('Z-Library not connected');

    const { stream, filename } = await this.zlibApi.downloadStream(creds.remixUserId, creds.remixUserKey, dto.bookId, dto.hash);

    const resolvedFilename = dto.filename || filename;
    const bookDockId = await this.bookDockIngest.ingestUpload(resolvedFilename, stream, user.id);
    return { bookDockId };
  }
}
