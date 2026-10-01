import { Module } from '@nestjs/common';
import { CourseSnapshotsModule } from '../course-snapshots/course-snapshots.module';
import { CourseServiceModule } from '../integrations/course-service/course-service.module';
import { TenantModule } from '../integrations/tenant/tenant.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsRepository } from './enrollments.repository';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [
    CourseServiceModule,
    TenantModule,
    PlatformSettingsModule,
    CourseSnapshotsModule,
  ],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EnrollmentsRepository],
  exports: [EnrollmentsService, EnrollmentsRepository],
})
export class EnrollmentsModule {}
