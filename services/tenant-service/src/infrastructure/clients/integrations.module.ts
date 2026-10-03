import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityClient } from './identity/identity.client';
import { CourseServiceClient } from './course/course-service.client';
import { FakeCourseServiceClient } from './course/fake-course-service.client';
import { HttpCourseServiceClient } from './course/http-course-service.client';
import { LearningServiceClient } from './learning/learning-service.client';
import { FakeLearningServiceClient } from './learning/fake-learning-service.client';
import { HttpLearningServiceClient } from './learning/http-learning-service.client';

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
    // UC13: tình trạng đào tạo của Learner. LEARNING_CLIENT_MODE=http gọi thật, còn lại dùng bản giả.
    {
      provide: LearningServiceClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService): LearningServiceClient =>
        config.get<string>('LEARNING_CLIENT_MODE') === 'http'
          ? new HttpLearningServiceClient(config)
          : new FakeLearningServiceClient(),
    },
  ],
  exports: [IdentityClient, CourseServiceClient, LearningServiceClient],
})
export class IntegrationsModule {}
