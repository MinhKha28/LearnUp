import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizeText } from '../../../common/utils/text.util';

const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;

export const AccountStatusAction = {
  Deactivate: 'DEACTIVATE',
  Reactivate: 'REACTIVATE',
} as const;

export type AccountStatusActionValue =
  (typeof AccountStatusAction)[keyof typeof AccountStatusAction];

// UC12.5 - Đổi trạng thái Instructor. BR-36, BR-41, BR-271 (lý do tùy chọn với hành động này).
export class ChangeAccountStatusDto {
  @ApiProperty({ enum: Object.values(AccountStatusAction) })
  @IsIn(Object.values(AccountStatusAction), {
    message: 'action phải là DEACTIVATE hoặc REACTIVATE',
  })
  action!: AccountStatusActionValue;

  // Chỉ dùng khi DEACTIVATE và Instructor còn phụ trách chuỗi Course (BR-41). REACTIVATE bỏ qua.
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'receiverInstructorId không hợp lệ' })
  receiverInstructorId?: string;

  // BR-271: lý do tùy chọn. Rỗng sau chuẩn hóa -> coi như không gửi.
  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(({ value }) => {
    const normalized = normalizeText(value);
    return normalized === '' ? undefined : normalized;
  })
  @IsOptional()
  @IsString({ message: 'Lý do phải là chuỗi' })
  @MaxLength(1000, { message: 'Lý do tối đa 1000 ký tự' })
  @Matches(NO_CONTROL_CHARS, { message: 'Lý do chứa ký tự không hợp lệ' })
  reason?: string;
}
