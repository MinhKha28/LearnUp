import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { COURSE_TYPE, type CourseType } from '../course-values';

export class UpdateCourseDto {
  @IsDefined()
  @IsString()
  @MaxLength(200)
  name!: string;

  // Bắt buộc gửi field, nhưng được phép null.
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsString()
  @MaxLength(500)
  shortDescription!: string | null;

  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsString()
  @MaxLength(2000)
  trainingObjectives!: string | null;

  @IsDefined()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  learningOutcomes!: string[];

  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsUUID()
  coverFileId!: string | null;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedCompletionDays!: number;

  @IsDefined()
  @IsString()
  @IsIn(Object.values(COURSE_TYPE))
  courseType!: CourseType;
}
