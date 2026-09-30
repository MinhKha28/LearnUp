import { PartialType } from '@nestjs/swagger';
import { CreateLearnerAssessmentStateDto } from './create-learner-assessment-states.dto';

export class UpdateLearnerAssessmentStateDto extends PartialType(CreateLearnerAssessmentStateDto) {}
