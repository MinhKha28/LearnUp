import { PartialType } from '@nestjs/swagger';
import { CreateQuizAttemptDto } from './create-quiz-attempts.dto';

export class UpdateQuizAttemptDto extends PartialType(CreateQuizAttemptDto) {}
