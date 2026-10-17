import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { REVIEW_COMMENT_MAX_LENGTH } from '../instructor-submissions.constants';

export class CriterionScoreDto {
  @ApiProperty()
  @IsUUID('all')
  criterionId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  points!: number;
}

export class InstructorReviewDto {
  @ApiProperty({ type: [CriterionScoreDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreDto)
  scores!: CriterionScoreDto[];

  @ApiProperty({ maxLength: REVIEW_COMMENT_MAX_LENGTH })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'A general comment is required for every review.' })
  @MaxLength(REVIEW_COMMENT_MAX_LENGTH)
  comment!: string;
}
