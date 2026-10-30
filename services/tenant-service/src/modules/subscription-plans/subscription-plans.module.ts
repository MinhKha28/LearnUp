import { Module } from '@nestjs/common';
import { SubscriptionPlansController } from './subscription-plans.controller';
import { AdminSubscriptionPlansController } from './admin-subscription-plans.controller';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionPlansRepository } from './subscription-plans.repository';

@Module({
  controllers: [SubscriptionPlansController, AdminSubscriptionPlansController],
  providers: [SubscriptionPlansService, SubscriptionPlansRepository],
})
export class SubscriptionPlansModule {}
