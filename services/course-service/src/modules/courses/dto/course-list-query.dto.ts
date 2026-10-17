import {
  COURSE_STATUS,
  COURSE_TYPE,
  type CourseStatus,
  type CourseType,
} from '../course-values';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CourseListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  current: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(Object.values(COURSE_TYPE))
  courseType?: CourseType;

  @IsOptional()
  @IsIn(Object.values(COURSE_STATUS))
  status?: CourseStatus;

  @IsOptional()
  @Transform(({ value }) => {
    const raw: unknown = value;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  })
  @IsBoolean()
  locked?: boolean;
}
