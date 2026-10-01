import { Module } from '@nestjs/common';
import { InternalCoursesController } from './internal-courses.controller';
import { InternalCoursesService } from './internal-courses.service';

@Module({
  controllers: [InternalCoursesController],
  providers: [InternalCoursesService],
  exports: [InternalCoursesService],
})
export class InternalCoursesModule {}
