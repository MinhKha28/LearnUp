import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ format: 'uuid', description: 'ID phiên bản Course' })
  @IsUUID('all')
  courseId!: string;
}
