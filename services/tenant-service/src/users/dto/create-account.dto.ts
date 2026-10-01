import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizeEmail, normalizeText } from '../../common/utils/text.util';

// Không chứa ký tự điều khiển (tab, xuống dòng đã được normalizeText đổi thành khoảng trắng).
const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;
// Không chứa < hoặc >: notification-service coi body email là HTML khi có cả hai ký tự này.
const NO_ANGLE_BRACKETS = /^[^<>]*$/;

// Body tạo tài khoản trong tổ chức (UC12.2 Instructor, sau này UC13.2 Learner). BR-34.
// @Transform chạy TRƯỚC khi kiểm tra (main.ts bật transform: true), nên độ dài đo sau chuẩn hóa.
// organizationId KHÔNG có ở đây: luôn lấy từ danh tính người gọi (forbidNonWhitelisted -> gửi lên là 400).
export class CreateAccountDto {
  @ApiProperty({ example: 'Trần Văn Minh', maxLength: 100 })
  @Transform(({ value }) => normalizeText(value))
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' })
  @Matches(NO_CONTROL_CHARS, { message: 'Họ tên chứa ký tự không hợp lệ' })
  @Matches(NO_ANGLE_BRACKETS, {
    message: 'Họ tên không được chứa ký tự < hoặc >',
  })
  fullName!: string;

  @ApiProperty({ example: 'minh.tran@abc.vn', maxLength: 254 })
  @Transform(({ value }) => normalizeEmail(value))
  @IsString({ message: 'Email phải là chuỗi' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254, { message: 'Email tối đa 254 ký tự' })
  @Matches(NO_CONTROL_CHARS, { message: 'Email chứa ký tự không hợp lệ' })
  email!: string;

  // BR-279: chữ nhập tự do, chuẩn hóa khoảng trắng khi lưu. Không bắt buộc; rỗng sau trim -> null.
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
