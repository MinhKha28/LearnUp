import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  MaxLength,
  NotContains,
  ValidateBy,
  ValidateIf,
} from 'class-validator';

const COMMENT_LIMIT = 2000;

export class FinalizeSubmissionDto {
  @ApiProperty({ minimum: 0, maximum: 100, multipleOf: 0.01 })
  @ValidateBy({
    name: 'isFinalScore',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'number' &&
        value >= 0 &&
        value <= 100 &&
        /^\d+(?:\.\d{1,2})?$/.test(String(value)),
      defaultMessage: () =>
        'Điểm cuối cùng phải là số từ 0 đến 100 và có tối đa 2 chữ số thập phân.',
    },
  })
  finalScore!: number;

  @ApiPropertyOptional({ maxLength: COMMENT_LIMIT })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_: unknown, value: unknown) => value !== undefined)
  @IsString({ message: 'Nhận xét phải là văn bản.' })
  @NotContains('\0', { message: 'Nhận xét chứa ký tự không hợp lệ.' })
  @MaxLength(COMMENT_LIMIT, {
    message: 'Nhận xét không được vượt quá 2.000 ký tự.',
  })
  comment?: string;
}
