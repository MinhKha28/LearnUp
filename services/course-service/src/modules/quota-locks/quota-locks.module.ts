import { Module } from '@nestjs/common';
import { QuotaLocksController } from './quota-locks.controller';
import { QuotaLocksService } from './quota-locks.service';

@Module({
  controllers: [QuotaLocksController],
  providers: [QuotaLocksService],
  exports: [QuotaLocksService],
})
export class QuotaLocksModule {}
