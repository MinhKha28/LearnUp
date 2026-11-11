import { IsString, Matches, MaxLength } from 'class-validator';

export class RejectCourseDto {
  @IsString()
  @Matches(/\S/, {
    message: 'Rejection reason is required.',
  })
  @MaxLength(1000)
  reason!: string;
}
