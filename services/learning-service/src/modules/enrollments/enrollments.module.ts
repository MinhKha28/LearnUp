import { AssessmentAccessController } from './assessment-access.controller';
import { AssessmentAccessService } from './assessment-access.service';
import { Module } from '@nestjs/common';
import { LearnerEnrollmentSummaryController } from './learner-enrollment-summary.controller';
import { LearnerEnrollmentSummaryService } from './learner-enrollment-summary.service';
import { LearnerEnrollmentSummaryRepository } from './learner-enrollment-summary.repository';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import {
  ENROLLMENT_RATE_LIMIT_TTL,
  readEnrollmentRateLimit,
} from './enrollment-rate-limit.config';
import { EnrollmentRateLimitGuard } from './enrollment-rate-limit.guard';
import { EnrollmentRateLimitStorage } from './enrollment-rate-limit.storage';

import { CourseSnapshotsModule } from '../course-snapshots/course-snapshots.module';
import { CourseServiceModule } from '../../infrastructure/clients/course/course-service.module';
import { TenantModule } from '../../infrastructure/clients/tenant/tenant.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { BaseDueAtRepository } from './base-due-at.repository';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsRepository } from './enrollments.repository';
import { EnrollmentsService } from './enrollments.service';
import { AssessmentModule } from '../../infrastructure/clients/assessment/assessment.module';
import { OptionalEnrollmentRepository } from './optional-enrollment.repository';
import { EnrollmentWithdrawalService } from './enrollment-withdrawal.service';

@Module({
  providers: [EnrollmentRateLimitStorage],
  exports: [EnrollmentRateLimitStorage],
})
class EnrollmentRateLimitStorageModule {}

/** Storage trong tiến trình chỉ đúng với một bản learning-service; scale ngang cần storage dùng chung. */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [EnrollmentRateLimitStorageModule],
      inject: [ConfigService, EnrollmentRateLimitStorage],
      useFactory: (
        config: ConfigService,
        storage: EnrollmentRateLimitStorage,
      ) => ({
        storage,
        throttlers: [
          {
            ttl: ENROLLMENT_RATE_LIMIT_TTL,
            limit: readEnrollmentRateLimit(
              config.get<string>('ENROLLMENT_RATE_LIMIT_PER_MINUTE'),
            ),
          },
        ],
      }),
    }),
    CourseServiceModule,
    AssessmentModule,
    TenantModule,
    PlatformSettingsModule,
    CourseSnapshotsModule,
  ],
  controllers: [
    AssessmentAccessController,
    EnrollmentsController,
    LearnerEnrollmentSummaryController,
  ],
  providers: [
    AssessmentAccessService,
    LearnerEnrollmentSummaryService,
    LearnerEnrollmentSummaryRepository,
    EnrollmentsService,
    OptionalEnrollmentRepository,
    EnrollmentWithdrawalService,
    EnrollmentsRepository,
    BaseDueAtRepository,
    EnrollmentRateLimitGuard,
  ],
  exports: [EnrollmentsService, EnrollmentsRepository, BaseDueAtRepository],
})
export class EnrollmentsModule {}
