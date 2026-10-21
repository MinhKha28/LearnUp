import { Module } from '@nestjs/common';
import { InternalCoursesController } from './internal-courses.controller';
import { InternalCoursesService } from './internal-courses.service';
import { InternalOrganizationsController } from './internal-organizations.controller';

@Module({
  controllers: [InternalCoursesController, InternalOrganizationsController],
  providers: [InternalCoursesService],
  exports: [InternalCoursesService],
})
export class InternalCoursesModule {}
