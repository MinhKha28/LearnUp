import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpgradeSubscriptionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({
    description: 'Mock Payment: giả lập giao dịch bị từ chối',
  })
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
