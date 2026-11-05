import { Module } from '@nestjs/common';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { LearnerAssessmentsController } from './learner-assessments.controller';
import { LearnerAssessmentsRepository } from './learner-assessments.repository';
import { LearnerAssessmentsService } from './learner-assessments.service';

@Module({
  imports: [QuizAttemptsModule],
  controllers: [LearnerAssessmentsController],
  providers: [LearnerAssessmentsService, LearnerAssessmentsRepository],
})
export class LearnerAssessmentsModule {}
