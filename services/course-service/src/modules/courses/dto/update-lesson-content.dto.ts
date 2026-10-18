import { IsDefined, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateLessonContentDto {
  @IsDefined()
  @IsString()
  @MaxLength(20000)
  @Matches(/\S/, {
    message: 'Lesson content cannot be empty.',
  })
  content!: string;
}
