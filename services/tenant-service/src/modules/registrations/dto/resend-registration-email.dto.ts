import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/text.util';

export class ResendRegistrationEmailDto {
  @ApiProperty({ example: 'lan@abc.vn' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254)
  email!: string;
}
