import { Module } from '@nestjs/common';
import { CourseSnapshotsController } from './course-snapshots.controller';
import { CourseSnapshotsService } from './course-snapshots.service';

@Module({
  controllers: [CourseSnapshotsController],
  providers: [CourseSnapshotsService],
  exports: [CourseSnapshotsService],
})
export class CourseSnapshotsModule {}
