import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/** UC18 query: the Course to list, optionally narrowed to one Module (BR-154). */
export class ListQuizzesQueryDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiPropertyOptional({
    description: 'Only the Quizzes attached to this Module',
  })
  @IsOptional()
  @IsUUID()
  moduleId?: string;
}
