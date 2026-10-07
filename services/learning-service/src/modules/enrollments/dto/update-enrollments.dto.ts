import { PartialType } from '@nestjs/swagger';
import { CreateEnrollmentDto } from './create-enrollments.dto';

export class UpdateEnrollmentDto extends PartialType(CreateEnrollmentDto) {}
