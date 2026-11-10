import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../../common/decorator/customize';
import {
  QUIZ_QUESTION_TYPES,
  type QuizQuestionType,
} from '../interfaces/quiz-detail.interface';
import {
  QUESTION_CONTENT_MAX_LENGTH,
  QUESTION_OPTIONS_MAX,
  OPTION_CONTENT_MAX_LENGTH,
} from '../quiz-question-rules';

/** One answer option of a SingleChoice or MultipleChoice question (quiz_question_options.content VARCHAR(500)). */
export class CreateQuizOptionDto {
  @ApiProperty({ maxLength: OPTION_CONTENT_MAX_LENGTH })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(OPTION_CONTENT_MAX_LENGTH)
  content!: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;
}

/**
 * UC18.2.1 — add one question with its answers to a Quiz (BR-194).
 * - SingleChoice / MultipleChoice: send `options` (2–10, in display order), never `correctAnswer`.
 * - TrueFalse: send `correctAnswer`, never `options`; the service writes the two options True / False itself.
 * The rules that depend on the type (how many options, how many correct) are in quiz-question-rules.ts.
 */
export class CreateQuizQuestionDto {
  @ApiProperty({ enum: QUIZ_QUESTION_TYPES })
  @IsIn(QUIZ_QUESTION_TYPES)
  type!: QuizQuestionType;

  @ApiProperty({ maxLength: QUESTION_CONTENT_MAX_LENGTH })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(QUESTION_CONTENT_MAX_LENGTH)
  content!: string;

  @ApiPropertyOptional({
    type: [CreateQuizOptionDto],
    description: 'SingleChoice / MultipleChoice only, in display order',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(QUESTION_OPTIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => CreateQuizOptionDto)
  options?: CreateQuizOptionDto[];

  @ApiPropertyOptional({
    description: 'TrueFalse only: true = the statement is true',
  })
  @IsOptional()
  @IsBoolean()
  correctAnswer?: boolean;
}
