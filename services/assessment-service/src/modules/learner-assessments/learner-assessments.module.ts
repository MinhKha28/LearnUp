import { Module } from '@nestjs/common';
import { LearnerAssessmentsController } from './learner-assessments.controller';
import { LearnerAssessmentsRepository } from './learner-assessments.repository';
import { LearnerAssessmentsService } from './learner-assessments.service';

@Module({
  controllers: [LearnerAssessmentsController],
  providers: [LearnerAssessmentsService, LearnerAssessmentsRepository],
})
export class LearnerAssessmentsModule {}
