import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourseServiceClient } from './course/course-service.client';
import { FakeCourseServiceClient } from './course/fake-course-service.client';
import { HttpCourseServiceClient } from './course/http-course-service.client';
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
      provide: TenantDirectoryClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TenantDirectoryClient =>
        config.get<string>('TENANT_CLIENT_MODE') === 'fake'
          ? new FakeTenantDirectoryClient()
          : new HttpTenantDirectoryClient(config),
    },
  ],
  exports: [CourseServiceClient, TenantDirectoryClient],
})
export class IntegrationsModule {}
