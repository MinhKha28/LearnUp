import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourseServiceClient } from './course-service.client';
import { readCourseServiceConfig } from './course-service.config';

@Module({
  providers: [
    {
      provide: CourseServiceClient,
      inject: [ConfigService],
      // Đọc cấu hình lúc khởi động: thiếu biến thì ứng dụng dừng ngay
      useFactory: (config: ConfigService) =>
        new CourseServiceClient(
          readCourseServiceConfig((key) => config.get<string>(key)),
        ),
    },
  ],
  exports: [CourseServiceClient],
})
export class CourseServiceModule {}
