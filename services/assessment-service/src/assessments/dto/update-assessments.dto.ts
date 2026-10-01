import { PartialType } from '@nestjs/swagger';
import { CreateAssessmentDto } from './create-assessments.dto';

export class UpdateAssessmentDto extends PartialType(CreateAssessmentDto) {}
