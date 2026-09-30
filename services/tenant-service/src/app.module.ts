import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
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
