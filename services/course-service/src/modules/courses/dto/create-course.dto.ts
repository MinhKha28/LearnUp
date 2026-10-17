import { COURSE_TYPE, type CourseType } from '../course-values';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCourseDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  trainingObjectives?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  learningOutcomes?: string[];

  @IsOptional()
  @IsUUID()
  coverFileId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedCompletionDays!: number;

  @IsString()
  @IsIn(Object.values(COURSE_TYPE))
  courseType!: CourseType;
}
