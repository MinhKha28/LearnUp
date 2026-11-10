import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Trim and collapse inner whitespace, so a title of spaces only becomes empty and is rejected. */
const normalizeTitle = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/**
 * UC18.2 — the Quiz configuration of BR-156. No prompt or peer review: those are Assignment-only.
 * n and m fall back to the platform parameters when omitted (BR-175, BR-269).
 */
export class CreateQuizDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Module to attach the Quiz to; empty = attached to the Course (BR-154)',
  })
  @IsOptional()
  @IsUUID()
  moduleId?: string | null;

  @ApiProperty({ maxLength: 200 })
  @Transform(normalizeTitle)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** At most one day (assessments.time_limit_minutes 1–1440). */
  @ApiProperty({ minimum: 1, maximum: 1440 })
  @IsInt()
  @Min(1)
  @Max(1440)
  timeLimitMinutes!: number;

  /** BR-315 scale, 2 decimals; the design requires it to be greater than 0. */
  @ApiProperty({ minimum: 0, exclusiveMinimum: true, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100)
  passingScore!: number;

  /** BR-157: Quizzes keep a required flag; no default, the Instructor must choose. */
  @ApiProperty()
  @IsBoolean()
  isRequired!: boolean;

  /** n — defaults to the platform parameter when omitted (BR-175). Same limit as Assignments. */
  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxConsecutiveAttempts?: number;

  /** m hours — defaults to the platform parameter when omitted (BR-175). At most one year, as for Assignments. */
  @ApiPropertyOptional({ minimum: 1, maximum: 8760 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  lockoutHours?: number;
}
