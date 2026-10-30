import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RenewSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Mock Payment: giả lập giao dịch bị từ chối',
  })
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
