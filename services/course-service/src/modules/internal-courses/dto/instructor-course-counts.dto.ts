import { ApiProperty } from '@nestjs/swagger';

export class InstructorCourseCountsDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Version chains in charge per Instructor id; 0 when none',
    example: { '01900000-0000-7000-8000-00000000a101': 2 },
  })
  counts!: Record<string, number>;
}
