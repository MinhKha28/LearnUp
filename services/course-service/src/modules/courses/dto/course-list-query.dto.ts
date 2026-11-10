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
  MaxLength,
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

  // UC14.4 - chuẩn hóa NFC + trim + gộp khoảng trắng; rỗng sau chuẩn hóa = không lọc.
  // Giới hạn 200 bằng CreateCourseDto.name.
  @Transform(({ value }) => {
    const raw: unknown = value;
    if (typeof raw !== 'string') return raw;
    const normalized = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
    return normalized === '' ? undefined : normalized;
  })
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
  @Transform(({ value }) => {
    const raw: unknown = value;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  })
  @IsBoolean()
  locked?: boolean;
}
