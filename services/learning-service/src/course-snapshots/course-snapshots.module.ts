import { Module } from '@nestjs/common';
import { CourseSnapshotsController } from './course-snapshots.controller';
import { CourseSnapshotsRepository } from './course-snapshots.repository';
import { CourseSnapshotsService } from './course-snapshots.service';

@Module({
  controllers: [CourseSnapshotsController],
  providers: [CourseSnapshotsService, CourseSnapshotsRepository],
  exports: [CourseSnapshotsService, CourseSnapshotsRepository],
})
export class CourseSnapshotsModule {}
