import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListSubmissionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by grading status' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiPropertyOptional({ description: 'Only the submissions of this Learner' })
  @IsOptional()
  @IsUUID()
  learnerId?: string;

  @ApiPropertyOptional({
    description:
      'true to list only the submissions the Instructor has to grade (status AwaitingInstructor)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  needsIntervention?: boolean;

  @ApiPropertyOptional({
    description:
      'Lowest final score to list (submissions not finalized have no score)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minScore?: number;

  @ApiPropertyOptional({ description: 'Highest final score to list' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxScore?: number;

  @ApiPropertyOptional({ description: 'Search by learner name or email' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    description: 'false to also list submissions replaced by a newer one',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value !== 'false')
  @IsBoolean()
  latestOnly: boolean = true;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
