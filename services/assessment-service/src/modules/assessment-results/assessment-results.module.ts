import { Module } from '@nestjs/common';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { AssessmentResultsController } from './assessment-results.controller';
import { AssessmentResultsRepository } from './assessment-results.repository';
import { AssessmentResultsService } from './assessment-results.service';

@Module({
  imports: [QuizAttemptsModule],
  controllers: [AssessmentResultsController],
  providers: [AssessmentResultsService, AssessmentResultsRepository],
})
export class AssessmentResultsModule {}
