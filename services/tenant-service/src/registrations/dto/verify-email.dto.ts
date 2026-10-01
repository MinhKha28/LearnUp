import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Mã trong liên kết xác thực email (email thứ hai)',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
