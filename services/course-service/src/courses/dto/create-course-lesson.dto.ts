import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCourseLessonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(20000)
  content!: string;
}
