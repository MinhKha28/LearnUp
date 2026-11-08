import { Module } from '@nestjs/common';
import { QuizAttemptSettler } from './quiz-attempt-settler';
import { QuizAttemptsController } from './quiz-attempts.controller';
import { QuizAttemptsRepository } from './quiz-attempts.repository';
import { QuizAttemptsSchedule } from './quiz-attempts.schedule';
import { QuizAttemptsService } from './quiz-attempts.service';

@Module({
  controllers: [QuizAttemptsController],
  providers: [
    QuizAttemptsService,
    QuizAttemptsRepository,
    QuizAttemptSettler,
    QuizAttemptsSchedule,
  ],
  // the lists and the completion snapshot settle the attempts that ran out of time before they read scores
  exports: [QuizAttemptSettler],
})
export class QuizAttemptsModule {}
