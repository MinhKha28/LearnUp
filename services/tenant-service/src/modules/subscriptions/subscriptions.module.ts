import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { SubscriptionActivationService } from './subscription-activation.service';
import { SubscriptionRenewalsService } from './subscription-renewals.service';
import { SubscriptionUpgradesService } from './subscription-upgrades.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PlatformSettingsModule, PaymentsModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionsRepository,
    SubscriptionRenewalsService,
    SubscriptionUpgradesService,
    SubscriptionActivationService,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
