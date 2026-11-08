import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** UC12.5: chuyển mọi chuỗi phiên bản của một Instructor sang Instructor khác (BR-287). */
export class TransferCourseChainsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  fromInstructorId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  toInstructorId!: string;
}
