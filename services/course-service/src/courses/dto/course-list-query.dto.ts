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
  @IsIn(['PUBLIC', 'PRIVATE'])
  courseType?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'PUBLISHED', 'REJECTED', 'ARCHIVED', 'DISABLED'])
  status?: string;

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
