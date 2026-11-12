import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
  IsISO8601,
} from 'class-validator';

const STATUSES = [
  'NotStarted',
  'InProgress',
  'Completed',
  'Overdue',
  'Exempted',
  'Withdrawn',
  'Halted',
] as const;

export type AssignmentStatus = (typeof STATUSES)[number];

function normalizeKeyword({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.normalize('NFC').trim() : value;
}

export class AssignmentListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(normalizeKeyword)
  @IsString()
  @Length(1, 100)
  learner?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(normalizeKeyword)
  @IsString()
  @Length(1, 100)
  course?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsIn(STATUSES)
  status?: AssignmentStatus;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Matches(/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  @IsISO8601({ strict: true })
  dueFrom?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Matches(/^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  @IsISO8601({ strict: true })
  dueTo?: string;
}
