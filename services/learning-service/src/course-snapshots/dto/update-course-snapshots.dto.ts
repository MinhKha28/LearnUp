import { PartialType } from '@nestjs/swagger';
import { CreateCourseSnapshotDto } from './create-course-snapshots.dto';

export class UpdateCourseSnapshotDto extends PartialType(CreateCourseSnapshotDto) {}
