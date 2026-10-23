import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ASSESSMENT_COMPLETION_CLIENT,
  createCompletionClient,
} from '../../infrastructure/clients/assessment/assessment-completion.client';
import { COMPLETION_CONFIG, readCompletionConfig } from './completion.config';
import { CompletionRepository } from './completion.repository';
import { CompletionService } from './completion.service';
import { CompletionWorker } from './completion.worker';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
const WORKER_DATABASE = Symbol('COMPLETION_WORKER_DATABASE');
@Module({
  providers: [
    {
      provide: WORKER_DATABASE,
      inject: [ConfigService, COMPLETION_CONFIG],
      useFactory: (
        c: ConfigService,
        config: ReturnType<typeof readCompletionConfig>,
      ) => new PrismaService(c, config.concurrency),
    },
    {
      provide: CompletionRepository,
      inject: [WORKER_DATABASE, COMPLETION_CONFIG],
      useFactory: (
        db: PrismaService,
        config: ReturnType<typeof readCompletionConfig>,
      ) => new CompletionRepository(db, config),
    },
    CompletionService,
    CompletionWorker,
    {
      provide: COMPLETION_CONFIG,
      inject: [ConfigService],
      useFactory: (c: ConfigService) =>
        readCompletionConfig((k) => c.get<string>(k)),
    },
    {
      provide: ASSESSMENT_COMPLETION_CLIENT,
      inject: [ConfigService],
      useFactory: (c: ConfigService) =>
        createCompletionClient((k) => c.get<string>(k)),
    },
  ],
  exports: [CompletionService, CompletionRepository],
})
export class CompletionModule {}
