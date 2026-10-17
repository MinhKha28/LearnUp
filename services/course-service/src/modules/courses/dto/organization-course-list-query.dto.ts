import {
  COURSE_STATUS,
  COURSE_TYPE,
  type CourseStatus,
  type CourseType,
} from '../course-values';
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
  @IsIn(Object.values(COURSE_TYPE))
  courseType?: CourseType;

  @IsOptional()
  @IsIn(Object.values(COURSE_STATUS))
  status?: CourseStatus;

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
