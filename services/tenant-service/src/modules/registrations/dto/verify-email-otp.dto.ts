import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/text.util';

export class VerifyEmailOtpDto {
  @ApiProperty({ example: 'lan@abc.vn' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: '482913',
    description: 'Mã 6 chữ số trong thư xác thực (BR-337)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Mã xác thực gồm 6 chữ số' })
  otp!: string;
}
