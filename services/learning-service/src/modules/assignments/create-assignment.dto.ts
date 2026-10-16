import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  courseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  learnerIds!: string[];
}
