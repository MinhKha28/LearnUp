import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAssignmentDto } from './create-assignment.dto';

/**
 * UC19.3 — every field is optional and only what is sent is changed. `promptFile: null`
 * removes the attachment. Which fields may change is decided by BR-98 / BR-173 / BR-319
 * in the service, because it depends on submissions and on the Course Locked flag.
 */
export class UpdateAssignmentDto extends PartialType(
  OmitType(CreateAssignmentDto, ['courseId'] as const),
) {}
