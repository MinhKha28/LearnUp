import { Controller } from '@nestjs/common';
import { LearnerAssessmentStatesService } from './learner-assessment-states.service';

@Controller('learner-assessment-states')
export class LearnerAssessmentStatesController {
  constructor(private readonly service: LearnerAssessmentStatesService) {}
}
