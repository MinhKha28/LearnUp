import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Mã trong liên kết mời (/activate/<token>)' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' }) // giới hạn của BCrypt
  password!: string;
}
