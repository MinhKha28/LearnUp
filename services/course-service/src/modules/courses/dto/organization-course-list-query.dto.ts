import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const COURSE_TYPES = ['PUBLIC', 'PRIVATE'] as const;

const COURSE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
  'DISABLED',
] as const;

export class OrganizationCourseListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  current = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(COURSE_TYPES)
  courseType?: string;

  @IsOptional()
  @IsIn(COURSE_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID()
  instructorId?: string;

  @IsOptional()
  @IsDateString()
  submittedFrom?: string;

  @IsOptional()
  @IsDateString()
  submittedTo?: string;
}
