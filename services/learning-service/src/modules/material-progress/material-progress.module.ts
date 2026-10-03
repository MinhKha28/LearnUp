import { Module } from '@nestjs/common';
import { MaterialProgressController } from './material-progress.controller';
import { MaterialProgressService } from './material-progress.service';

@Module({
  controllers: [MaterialProgressController],
  providers: [MaterialProgressService],
  exports: [MaterialProgressService],
})
export class MaterialProgressModule {}
