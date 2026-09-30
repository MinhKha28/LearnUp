import { Module } from '@nestjs/common';
import { LearnerAssessmentStatesController } from './learner-assessment-states.controller';
import { LearnerAssessmentStatesService } from './learner-assessment-states.service';

@Module({
  controllers: [LearnerAssessmentStatesController],
  providers: [LearnerAssessmentStatesService],
  exports: [LearnerAssessmentStatesService],
})
export class LearnerAssessmentStatesModule {}
