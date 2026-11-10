import { ApiProperty } from '@nestjs/swagger';
import { COURSE_STATUS, COURSE_TYPE } from '../../courses/course-values';

/**
 * Một chuỗi phiên bản Instructor đang phụ trách (BR-287), đại diện bằng phiên bản hiện hành (BR-336):
 * phiên bản có ngày phê duyệt gần nhất, kể cả đang Disabled; chuỗi chưa từng được duyệt thì lấy phiên bản mới nhất.
 */
export class ManagedCourseChainDto {
  @ApiProperty({ format: 'uuid' })
  chainId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Id of the representative version',
  })
  courseId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  versionNumber!: number;

  @ApiProperty({ enum: Object.values(COURSE_STATUS) })
  status!: string;

  @ApiProperty({ enum: Object.values(COURSE_TYPE) })
  courseType!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'published_at of the representative version; null when the chain was never approved',
  })
  approvedAt!: Date | null;
}

export class ManagedCourseChainsDto {
  @ApiProperty({ type: [ManagedCourseChainDto] })
  chains!: ManagedCourseChainDto[];
}

export class TransferredCourseChainsDto {
  @ApiProperty({
    type: [ManagedCourseChainDto],
    description:
      'Chains moved by this call; empty when nothing was left to move',
  })
  transferred!: ManagedCourseChainDto[];
}
