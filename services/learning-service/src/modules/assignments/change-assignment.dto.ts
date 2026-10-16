import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const normalizeReason = (value: unknown) =>
  typeof value === 'string' ? value.normalize('NFC').trim() : value;

export class ExtendAssignmentDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  newDueDate!: string;

  @Transform(({ value }) => normalizeReason(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
