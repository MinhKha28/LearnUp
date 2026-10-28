import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourseServiceClient } from './course/course-service.client';
import { FakeCourseServiceClient } from './course/fake-course-service.client';
import { HttpCourseServiceClient } from './course/http-course-service.client';
import { EnrollmentClient } from './learning/enrollment.client';
import { FakeEnrollmentClient } from './learning/fake-enrollment.client';
import { HttpEnrollmentClient } from './learning/http-enrollment.client';
import { FakeNotificationClient } from './notification/fake-notification.client';
import { HttpNotificationClient } from './notification/http-notification.client';
import { NotificationClient } from './notification/notification.client';
import { FakeTenantDirectoryClient } from './tenant/fake-tenant-directory.client';
import { HttpTenantDirectoryClient } from './tenant/http-tenant-directory.client';
import { TenantDirectoryClient } from './tenant/tenant-directory.client';

// Gom các client gọi sang service khác (cùng khuôn với tenant-service/src/integrations).
@Global()
@Module({
  providers: [
    {
      provide: CourseServiceClient,
      inject: [ConfigService],
      // Mặc định là http: bản giả bỏ qua kiểm tra người phụ trách Course nên chỉ bật khi nói rõ COURSE_CLIENT_MODE=fake.
      useFactory: (config: ConfigService): CourseServiceClient =>
        config.get<string>('COURSE_CLIENT_MODE') === 'fake'
          ? new FakeCourseServiceClient(config)
          : new HttpCourseServiceClient(config),
    },
    {
      provide: EnrollmentClient,
      inject: [ConfigService],
      // Mặc định là http: bản giả coi mọi Learner đã Enroll mọi Course nên chỉ bật khi nói rõ ENROLLMENT_CLIENT_MODE=fake.
      useFactory: (config: ConfigService): EnrollmentClient =>
        config.get<string>('ENROLLMENT_CLIENT_MODE') === 'fake'
          ? new FakeEnrollmentClient()
          : new HttpEnrollmentClient(config),
    },
    {
      provide: TenantDirectoryClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TenantDirectoryClient =>
        config.get<string>('TENANT_CLIENT_MODE') === 'fake'
          ? new FakeTenantDirectoryClient()
          : new HttpTenantDirectoryClient(config),
    },
    {
      provide: NotificationClient,
      inject: [ConfigService],
      // Default is fake: a notification is a side effect that must never stop the work, so only a real stack sets http.
      useFactory: (config: ConfigService): NotificationClient =>
        config.get<string>('NOTIFICATION_CLIENT_MODE') === 'http'
          ? new HttpNotificationClient(config)
          : new FakeNotificationClient(),
    },
  ],
  exports: [
    CourseServiceClient,
    EnrollmentClient,
    TenantDirectoryClient,
    NotificationClient,
  ],
})
export class IntegrationsModule {}
