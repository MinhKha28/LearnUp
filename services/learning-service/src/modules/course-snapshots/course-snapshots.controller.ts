import { Controller } from '@nestjs/common';
import { CourseSnapshotsService } from './course-snapshots.service';

@Controller('course-snapshots')
export class CourseSnapshotsController {
  constructor(private readonly service: CourseSnapshotsService) {}
}
