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
@Module({
  providers: [
    CompletionRepository,
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
