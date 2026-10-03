import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { EnrollmentStatusIntervalsModule } from './modules/enrollment-status-intervals/enrollment-status-intervals.module';
import { MaterialProgressModule } from './modules/material-progress/material-progress.module';
import { CourseSnapshotsModule } from './modules/course-snapshots/course-snapshots.module';
import { LearnerAccountsModule } from './modules/learner-accounts/learner-accounts.module';
import { OrganizationSuspensionsModule } from './modules/organization-suspensions/organization-suspensions.module';
import { PlatformSettingsModule } from './modules/platform-settings/platform-settings.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { RolesGuard } from './common/guards/roles.guard';
import { CourseServiceModule } from './infrastructure/integrations/course-service/course-service.module';
import { TenantModule } from './infrastructure/integrations/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EnrollmentsModule,
    CurriculumModule,
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
