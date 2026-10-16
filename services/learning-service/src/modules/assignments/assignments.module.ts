import { Module } from '@nestjs/common';
import { CourseServiceModule } from '../../infrastructure/clients/course/course-service.module';
import { TenantModule } from '../../infrastructure/clients/tenant/tenant.module';
import { CourseSnapshotsModule } from '../course-snapshots/course-snapshots.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { AssignmentsRepository } from './assignments.repository';

@Module({
  imports: [
    CourseServiceModule,
    TenantModule,
    CourseSnapshotsModule,
    EnrollmentsModule,
    PlatformSettingsModule,
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, AssignmentsRepository],
})
export class AssignmentsModule {}
