import { Module } from '@nestjs/common';
import { InternalCoursesController } from './internal-courses.controller';
import { InternalCoursesService } from './internal-courses.service';
import { InternalOrganizationsController } from './internal-organizations.controller';
import { InternalMaterialsController } from './internal-materials.controller';
import { StorageModule } from '@/infrastructure/storage/storage.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [StorageModule, CoursesModule],
  controllers: [
    InternalCoursesController,
    InternalOrganizationsController,
    InternalMaterialsController,
  ],
  providers: [InternalCoursesService],
  exports: [InternalCoursesService],
})
export class InternalCoursesModule {}
