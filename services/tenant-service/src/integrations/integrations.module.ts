import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityClient } from './identity.client';
import { CourseServiceClient } from './course-service.client';
import { FakeCourseServiceClient } from './fake-course-service.client';
import { HttpCourseServiceClient } from './http-course-service.client';

// Gom các client gọi sang service khác. Global để UC02 (registrations) và UC04 (invitations) đều tiêm được.
@Global()
@Module({
  providers: [
    IdentityClient,
    // UC12: số Course Instructor phụ trách. COURSE_CLIENT_MODE=http gọi thật, còn lại dùng bản giả.
    {
      provide: CourseServiceClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService): CourseServiceClient =>
        config.get<string>('COURSE_CLIENT_MODE') === 'http'
          ? new HttpCourseServiceClient(config)
          : new FakeCourseServiceClient(),
    },
  ],
  exports: [IdentityClient, CourseServiceClient],
})
export class IntegrationsModule {}
