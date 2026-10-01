import { PartialType } from '@nestjs/swagger';
import { CreateCompletedEnrollmentDto } from './create-completed-enrollments.dto';

export class UpdateCompletedEnrollmentDto extends PartialType(CreateCompletedEnrollmentDto) {}
