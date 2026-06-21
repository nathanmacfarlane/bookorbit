import { Module } from '@nestjs/common';

import { BookModule } from '../book/book.module';
import { LibraryModule } from '../library/library.module';
import { ReadingQueueController } from './reading-queue.controller';
import { ReadingQueueRepository } from './reading-queue.repository';
import { ReadingQueueService } from './reading-queue.service';

@Module({
  imports: [BookModule, LibraryModule],
  controllers: [ReadingQueueController],
  providers: [ReadingQueueService, ReadingQueueRepository],
  exports: [ReadingQueueService],
})
export class ReadingQueueModule {}
