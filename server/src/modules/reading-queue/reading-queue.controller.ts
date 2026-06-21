import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { AddQueueItemDto } from './dto/add-queue-item.dto';
import { ReorderQueueDto } from './dto/reorder-queue.dto';
import { ReadingQueueService } from './reading-queue.service';

@Controller('reading-queue')
export class ReadingQueueController {
  constructor(private readonly service: ReadingQueueService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.service.getQueue(user);
  }

  @Post()
  add(@Body() dto: AddQueueItemDto, @CurrentUser() user: RequestUser) {
    return this.service.addBook(user, dto.bookId);
  }

  @Put('reorder')
  reorder(@Body() dto: ReorderQueueDto, @CurrentUser() user: RequestUser) {
    return this.service.reorder(user, dto.bookIds);
  }

  @Delete(':bookId')
  remove(@Param('bookId', ParseIntPipe) bookId: number, @CurrentUser() user: RequestUser) {
    return this.service.removeBook(user, bookId);
  }
}
