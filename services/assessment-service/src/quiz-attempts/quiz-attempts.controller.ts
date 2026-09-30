import { Controller } from '@nestjs/common';
import { QuizAttemptsService } from './quiz-attempts.service';

@Controller('quiz-attempts')
export class QuizAttemptsController {
  constructor(private readonly service: QuizAttemptsService) {}
}
