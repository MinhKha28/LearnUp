import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/** assessment-service tells the total expected duration of all the Assignments of a Course version (UC19, BR-51). */
export class SetAssignmentMinutesDto {
  @ApiProperty({
    minimum: 0,
    maximum: 100000000,
    description:
      'Tổng thời lượng dự kiến (phút) của mọi Assignment của phiên bản Course. Là tổng tuyệt đối, không phải phần chênh lệch, nên gửi lại nhiều lần vẫn đúng.',
  })
  @IsInt()
  @Min(0)
  @Max(100000000)
  minutes!: number;
}
