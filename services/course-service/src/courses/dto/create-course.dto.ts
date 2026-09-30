import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  trainingObjective?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedCompletionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDurationMinutes?: number;
}
