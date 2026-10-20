import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { normalizeEmail, normalizeText } from '../../../common/utils/text.util';

// Cùng quy tắc với CreateAccountDto.
const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;
const NO_ANGLE_BRACKETS = /^[^<>]*$/;

// Body sửa tài khoản trong tổ chức (UC12.3 Instructor, sau này UC13.3 Learner). BR-34, BR-279.
// Mọi trường tùy chọn: không gửi = không đổi. Ai được sửa trường nào do service quyết theo activatedAt.
// fullName / email dùng ValidateIf thay vì IsOptional để gửi null vẫn bị 400 (cột NOT NULL).
export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Trần Văn Minh', maxLength: 100 })
  @Transform(({ value }) => normalizeText(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' })
  @Matches(NO_CONTROL_CHARS, { message: 'Họ tên chứa ký tự không hợp lệ' })
  @Matches(NO_ANGLE_BRACKETS, {
    message: 'Họ tên không được chứa ký tự < hoặc >',
  })
  fullName?: string;

  @ApiPropertyOptional({ example: 'minh.tran@abc.vn', maxLength: 254 })
  @Transform(({ value }) => normalizeEmail(value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Email phải là chuỗi' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254, { message: 'Email tối đa 254 ký tự' })
  @Matches(NO_CONTROL_CHARS, { message: 'Email chứa ký tự không hợp lệ' })
  email?: string;

  // BR-279: rỗng sau chuẩn hóa hoặc null -> xóa đơn vị công tác (lưu null).
  @ApiPropertyOptional({
    example: 'Phòng Kỹ thuật',
    maxLength: 100,
    nullable: true,
  })
  @Transform(({ value }) => {
    const normalized = normalizeText(value);
    return normalized === '' ? null : normalized;
  })
  @IsOptional()
  @IsString({ message: 'Đơn vị công tác phải là chuỗi' })
  @MaxLength(100, { message: 'Đơn vị công tác tối đa 100 ký tự' })
  @Matches(NO_CONTROL_CHARS, {
    message: 'Đơn vị công tác chứa ký tự không hợp lệ',
  })
  @Matches(NO_ANGLE_BRACKETS, {
    message: 'Đơn vị công tác không được chứa ký tự < hoặc >',
  })
  department?: string | null;
}
