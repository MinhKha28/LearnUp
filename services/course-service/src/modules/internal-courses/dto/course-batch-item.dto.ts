import { COURSE_STATUS, COURSE_TYPE } from '../../courses/course-values';
import { ApiProperty } from '@nestjs/swagger';

export class CourseBatchItemDto {
  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty({ format: 'uuid' })
  chainId!: string;

  @ApiProperty()
  versionNumber!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Object.values(COURSE_TYPE) })
  courseType!: string;

  @ApiProperty({
    enum: Object.values(COURSE_STATUS),
  })
  status!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  coverFileId!: string | null;
}
