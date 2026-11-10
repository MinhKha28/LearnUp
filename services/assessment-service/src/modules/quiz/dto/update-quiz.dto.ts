import { PartialType, PickType } from '@nestjs/swagger';
import { CreateQuizDto } from './create-quiz.dto';

/**
 * UC18.4 — the five configuration fields of BR-156, each optional; only what is sent is changed.
 * Same validation as UC18.2. Title, Course and Module are not part of it (any other field is a 400).
 * Which fields may change now is decided in the service (BR-94, BR-97, BR-285).
 */
export class UpdateQuizConfigDto extends PartialType(
  PickType(CreateQuizDto, [
    'timeLimitMinutes',
    'passingScore',
    'isRequired',
    'maxConsecutiveAttempts',
    'lockoutHours',
  ] as const),
) {}
