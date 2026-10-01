import { ApiProperty } from '@nestjs/swagger';

export class LessonContentDto {
  @ApiProperty({ format: 'uuid' })
  lessonId!: string;

  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ description: 'Nội dung Markdown của Lesson' })
  content!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  disabledAt!: Date | null;
}
