import { Module } from '@nestjs/common';

import { BookDockModule } from '../book-dock/book-dock.module';
import { ZlibApiService } from './zlib-api.service';
import { ZlibController } from './zlib.controller';
import { ZlibCredentialsService } from './zlib-credentials.service';

@Module({
  imports: [BookDockModule],
  controllers: [ZlibController],
  providers: [ZlibApiService, ZlibCredentialsService],
})
export class ZlibModule {}
