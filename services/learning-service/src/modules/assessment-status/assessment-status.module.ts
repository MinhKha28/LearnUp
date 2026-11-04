import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ASSESSMENT_STATUS_CONFIG,
  readAssessmentStatusConfig,
} from './assessment-status.config';
import { AssessmentStatusConsumer } from './assessment-status.consumer';
import { AssessmentStatusRepository } from './assessment-status.repository';
@Module({
  providers: [
    AssessmentStatusRepository,
    AssessmentStatusConsumer,
    {
      provide: ASSESSMENT_STATUS_CONFIG,
      inject: [ConfigService],
      useFactory: (c: ConfigService) =>
        readAssessmentStatusConfig((k) => c.get<string>(k)),
    },
  ],
})
export class AssessmentStatusModule {}
