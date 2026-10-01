import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

// Trang UC26 có 20 dòng; 100 dư cho các màn hình khác
export const COURSE_BATCH_MAX_SIZE = 100;

export class CourseBatchQueryDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: COURSE_BATCH_MAX_SIZE,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(COURSE_BATCH_MAX_SIZE)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  courseIds!: string[];
}
