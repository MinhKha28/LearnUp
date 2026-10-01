import { PartialType } from '@nestjs/swagger';
import { CreateEnrollmentStatusIntervalDto } from './create-enrollment-status-intervals.dto';

export class UpdateEnrollmentStatusIntervalDto extends PartialType(CreateEnrollmentStatusIntervalDto) {}
