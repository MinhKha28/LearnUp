import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { EnrollmentStatusIntervalsModule } from './enrollment-status-intervals/enrollment-status-intervals.module';
import { MaterialProgressModule } from './material-progress/material-progress.module';
import { CourseSnapshotsModule } from './course-snapshots/course-snapshots.module';
import { LearnerAccountsModule } from './learner-accounts/learner-accounts.module';
import { OrganizationSuspensionsModule } from './organization-suspensions/organization-suspensions.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { OutboxModule } from './outbox/outbox.module';
import { RolesGuard } from './common/guards/roles.guard';
import { CourseServiceModule } from './integrations/course-service/course-service.module';
import { TenantModule } from './integrations/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EnrollmentsModule,
    EnrollmentStatusIntervalsModule,
    MaterialProgressModule,
    CourseSnapshotsModule,
    LearnerAccountsModule,
    OrganizationSuspensionsModule,
    PlatformSettingsModule,
    OutboxModule,
    CourseServiceModule,
    TenantModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
    // Sau InternalAuthGuard: Nest chạy APP_GUARD theo thứ tự khai báo
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
