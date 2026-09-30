import { Module } from '@nestjs/common';
import { MediaFilesController } from './media-files.controller';
import { MediaFilesService } from './media-files.service';

@Module({
  controllers: [MediaFilesController],
  providers: [MediaFilesService],
  exports: [MediaFilesService],
})
export class MediaFilesModule {}
