import type { CurrentUser } from '@learnup/ts-common';

export interface CourseAuthoringContext {
  courseId: string;
  organizationId: string;
  instructorId: string;
  status: string;
  locked: boolean;
  disabled: boolean;
}

/**
 * Hỏi course-service những điều assessment-service không sở hữu: người phụ trách Course (BR-79, BR-287),
 * trạng thái vòng đời và cờ Locked (BR-80). Cần câu trả lời ngay nên dùng REST, không dùng Kafka (ADR 0004).
 *
 * Bản dùng thật: HttpCourseServiceClient. Bản giả: FakeCourseServiceClient.
 * Chọn bằng COURSE_CLIENT_MODE=http|fake (integrations.module.ts); mặc định là http.
 *
 * Abstract class (không phải interface) để dùng trực tiếp làm token DI.
 */
export abstract class CourseServiceClient {
  /**
   * Lấy thông tin biên soạn của một Course.
   * Ném NotFoundException khi Course không tồn tại, ServiceUnavailableException khi không gọi được course-service.
   */
  abstract getAuthoringContext(
    courseId: string,
    user: CurrentUser,
  ): Promise<CourseAuthoringContext>;
}
