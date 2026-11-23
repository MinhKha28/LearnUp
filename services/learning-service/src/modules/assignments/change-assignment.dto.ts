import { HttpException, Injectable, type PipeTransform } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsString,
  Matches,
  MaxLength,
  MinLength,
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

abstract class EmptyAssignmentBodyPipe implements PipeTransform<unknown, void> {
  protected abstract readonly action: string;
  transform(body: unknown): void {
    if (
      body !== undefined &&
      (body === null ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length)
    ) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: `${this.action} không nhận dữ liệu bổ sung.`,
        },
        422,
      );
    }
  }
}

@Injectable()
export class RemoveExemptionBodyPipe extends EmptyAssignmentBodyPipe {
  protected readonly action = 'Gỡ miễn';
}

@Injectable()
export class CancelAssignmentBodyPipe extends EmptyAssignmentBodyPipe {
  protected readonly action = 'Hủy phân công';
}

export class ExemptAssignmentDto {
  @Transform(({ value }) => normalizeReason(value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
