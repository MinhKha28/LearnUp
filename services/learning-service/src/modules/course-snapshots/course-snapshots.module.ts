import { Module } from '@nestjs/common';
import { CourseServiceModule } from '../../infrastructure/clients/course/course-service.module';
import { CourseSnapshotPreparationService } from './course-snapshot-preparation.service';
import { CourseSnapshotsController } from './course-snapshots.controller';
import { CourseSnapshotsRepository } from './course-snapshots.repository';
import { CourseSnapshotsService } from './course-snapshots.service';

@Module({
  imports: [CourseServiceModule],
  controllers: [CourseSnapshotsController],
  providers: [
    CourseSnapshotsService,
    CourseSnapshotsRepository,
    CourseSnapshotPreparationService,
  ],
  exports: [
    CourseSnapshotsService,
    CourseSnapshotsRepository,
    CourseSnapshotPreparationService,
  ],
})
export class CourseSnapshotsModule {}
