import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizeText } from '../../../common/utils/text.util';

const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;

/**
 * UC12.6 - Xóa Instructor (BR-37, BR-41, BR-271). Cũng là phần chung của ChangeAccountStatusDto (UC12.5):
 * người tiếp nhận chuỗi Course + lý do tùy chọn.
 */
export class DeleteAccountDto {
  // Chỉ dùng khi Instructor còn phụ trách chuỗi Course (BR-41, BR-287).
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'receiverInstructorId không hợp lệ' })
  receiverInstructorId?: string;

  // BR-271: lý do tùy chọn. Rỗng sau chuẩn hóa -> coi như không gửi. Chỉ ghi nhật ký, không gửi trong thư.
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
