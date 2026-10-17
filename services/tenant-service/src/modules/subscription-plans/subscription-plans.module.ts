import { Module } from '@nestjs/common';
import { SubscriptionPlansController } from './subscription-plans.controller';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionPlansRepository } from './subscription-plans.repository';

@Module({
  controllers: [SubscriptionPlansController],
  providers: [SubscriptionPlansService, SubscriptionPlansRepository],
})
export class SubscriptionPlansModule {}
