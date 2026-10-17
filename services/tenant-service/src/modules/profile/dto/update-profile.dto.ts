import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { normalizeText } from '../../../common/utils/text.util';

const NO_CONTROL_CHARS = /^[^\p{Cc}]*$/u;
const NO_ANGLE_BRACKETS = /^[^<>]*$/;

export class UpdateProfileDto {
  @ApiProperty({ example: 'Phạm Thanh Lượng', maxLength: 100 })
  @Transform(({ value }) => normalizeText(value))
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' })
  @Matches(NO_CONTROL_CHARS, { message: 'Họ tên chứa ký tự không hợp lệ' })
  @Matches(NO_ANGLE_BRACKETS, {
    message: 'Họ tên không được chứa ký tự < hoặc >',
  })
  fullName!: string;
}
