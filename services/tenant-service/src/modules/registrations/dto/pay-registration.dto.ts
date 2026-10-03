import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PayRegistrationDto {
  @ApiProperty({
    description: 'Mã trong liên kết mở lại đăng ký (paymentToken)',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({
    description: 'Chỉ để demo: true thì Mock Payment Service trả về thất bại',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
