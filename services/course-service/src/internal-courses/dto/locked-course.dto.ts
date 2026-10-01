import { ApiProperty } from '@nestjs/swagger';

export class LockedCourseDto {
  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ format: 'uuid' })
  chainId!: string;

  @ApiProperty({ minimum: 1, maximum: 365 })
  expectedCompletionDays!: number;

  @ApiProperty({ enum: ['Public', 'Private'] })
  courseType!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  lockedAt!: Date;
}
