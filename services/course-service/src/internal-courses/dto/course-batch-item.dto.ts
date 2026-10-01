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

  @ApiProperty({ enum: ['Public', 'Private'] })
  courseType!: string;

  @ApiProperty({
    enum: [
      'Draft',
      'Submitted',
      'Published',
      'Rejected',
      'Archived',
      'Disabled',
    ],
  })
  status!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  coverFileId!: string | null;
}
