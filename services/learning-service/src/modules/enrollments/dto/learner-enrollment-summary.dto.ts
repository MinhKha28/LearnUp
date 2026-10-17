import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class LearnerEnrollmentSummaryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((value: unknown) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID('all', { each: true })
  learnerIds!: string[];
}
