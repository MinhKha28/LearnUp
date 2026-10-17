import { ApiProperty } from '@nestjs/swagger';

export class AssignmentMinutesDto {
  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty({ minimum: 0 })
  assignmentMinutes!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  assignmentMinutesAsOf!: Date;
}
