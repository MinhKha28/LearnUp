import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { IntegrationsModule } from './infrastructure/clients/integrations.module';
import { SubscriptionPlansModule } from './modules/subscription-plans/subscription-plans.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { UsersModule } from './modules/users/users.module';
import { UsersController } from './modules/users/users.controller';
import { DevFakeAuthMiddleware } from './common/middleware/dev-fake-auth.middleware';
import { InvitationsModule } from './invitations/invitations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // bật @Interval / @Cron (EmailRelayService)
    PrismaModule,
    OutboxModule, // @Global: OutboxService + relay gửi email
    IntegrationsModule, // @Global: IdentityClient
    SubscriptionPlansModule,
    RegistrationsModule,
    UsersModule, // UC12
    InvitationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  // TẠM THỜI: fake danh tính khi chưa đi qua api-gateway. Chỉ có tác dụng khi
  // DEV_FAKE_AUTH=true và NODE_ENV !== 'production' (xem dev-fake-auth.middleware.ts).
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevFakeAuthMiddleware).forRoutes(UsersController);
  }
}
