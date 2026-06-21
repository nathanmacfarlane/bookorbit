import { IsInt, Min } from 'class-validator';

export class AddQueueItemDto {
  @IsInt()
  @Min(1)
  bookId: number;
}
