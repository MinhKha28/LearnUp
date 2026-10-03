import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { IntegrationsModule } from './infrastructure/clients/integrations.module';
import { PeerReviewModule } from './modules/peer-review/peer-review.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { QuizModule } from './modules/quiz/quiz.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IntegrationsModule,
    AssessmentsModule,
    PeerReviewModule,
    QuizModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
  ],
})
export class AppModule {}
