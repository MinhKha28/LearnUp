import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCourseModuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}
