import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { OutboxModule } from './outbox/outbox.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // bật @Interval / @Cron (EmailRelayService)
    PrismaModule,
    OutboxModule, // @Global: OutboxService + relay gửi email
    IntegrationsModule, // @Global: IdentityClient
    SubscriptionPlansModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
  ],
})
export class AppModule {}
