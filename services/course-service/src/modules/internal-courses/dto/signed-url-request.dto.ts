import { IsUUID } from 'class-validator';

export class SignedUrlRequestDto {
  @IsUUID('all')
  courseId!: string;
}
