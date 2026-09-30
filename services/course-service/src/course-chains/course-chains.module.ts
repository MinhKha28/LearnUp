import { Module } from '@nestjs/common';
import { CourseChainsController } from './course-chains.controller';
import { CourseChainsService } from './course-chains.service';

@Module({
  controllers: [CourseChainsController],
  providers: [CourseChainsService],
  exports: [CourseChainsService],
})
export class CourseChainsModule {}
