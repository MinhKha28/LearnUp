import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import {
  CourseAuthoringContext,
  CourseServiceClient,
} from './course-service.client';

/**
 * Bản giả để chạy và thử assessment-service khi chưa bật course-service (COURSE_CLIENT_MODE=fake).
 *
 * CẢNH BÁO: mọi Course đều bị coi là thuộc người gọi, nên các kiểm tra BR-79 (người phụ trách) không còn tác dụng.
 * Chỉ dùng khi dev/test, không bao giờ dùng ở môi trường thật.
 *
 * Hai biến tùy chọn để thử các nhánh khác nhau của BR (đọc lúc có request, đổi xong chỉ cần restart):
 *   FAKE_COURSE_STATUS  Draft (mặc định) | Submitted | Published | Rejected | Archived ...
 *   FAKE_COURSE_LOCKED  true để giả lập Course đã Locked (BR-318, BR-319, BR-185)
 */
export class FakeCourseServiceClient extends CourseServiceClient {
  private readonly logger = new Logger(FakeCourseServiceClient.name);

  constructor(private readonly config: ConfigService) {
    super();
    this.logger.warn(
      '[FAKE] COURSE_CLIENT_MODE=fake: không gọi course-service, mọi Course coi như thuộc người gọi và chưa Locked.',
    );
  }

  getAuthoringContext(
    courseId: string,
    user: CurrentUser,
  ): Promise<CourseAuthoringContext> {
    return Promise.resolve({
      courseId,
      organizationId: user.organizationId ?? '',
      instructorId: user.userId,
      status: this.config.get<string>('FAKE_COURSE_STATUS') ?? 'Draft',
      locked: this.config.get<string>('FAKE_COURSE_LOCKED') === 'true',
      disabled: false,
    });
  }
}
