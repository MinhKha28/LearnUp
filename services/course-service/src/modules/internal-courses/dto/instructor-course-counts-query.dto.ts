import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export const INSTRUCTOR_COUNT_MAX_SIZE = 200;

export class InstructorCourseCountsQueryDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: INSTRUCTOR_COUNT_MAX_SIZE,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(INSTRUCTOR_COUNT_MAX_SIZE)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  instructorIds!: string[];
}
