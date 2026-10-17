import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * UC19.5 — peer review configuration (BR-183). When `enabled` is true the reviewer
 * count and score-gap threshold are required; cycle length and review deadline fall
 * back to the platform defaults (7 and 3 days) when omitted.
 */
export class UpdatePeerReviewDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  /** N — reviewers per submission, 2 to 5 (UC19.5 step 3). */
  @ApiPropertyOptional({ minimum: 2, maximum: 5 })
  @ValidateIf((o: UpdatePeerReviewDto) => o.enabled)
  @IsInt()
  @Min(2)
  @Max(5)
  reviewersPerSubmission?: number;

  /** L — cycle length in days (BR-184, BR-312). */
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32767)
  cycleDays?: number;

  /** D — review deadline in days, counted from the cycle close date (BR-187). */
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32767)
  deadlineDays?: number;

  /** Max-min gap of valid review scores that sends a submission to the Instructor (BR-321), on the 0-100 scale. */
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @ValidateIf((o: UpdatePeerReviewDto) => o.enabled)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  scoreGap?: number;
}
