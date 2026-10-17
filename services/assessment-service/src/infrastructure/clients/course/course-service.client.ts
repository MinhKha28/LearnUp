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

  /**
   * UC19 (BR-51, BR-172): báo cho course-service tổng thời lượng dự kiến (phút) của mọi Assignment của Course,
   * để cộng vào thời lượng ước tính của Course. Gửi tổng tuyệt đối nên gọi lại bao nhiêu lần cũng đúng.
   * Ném ServiceUnavailableException khi không gọi được; người gọi chỉ ghi log, không để việc này làm hỏng thao tác của Instructor.
   */
  abstract setAssignmentMinutes(
    courseId: string,
    minutes: number,
    user: CurrentUser,
  ): Promise<void>;

  /**
   * Lấy id các Module của một Course (UC18.2: kiểm moduleId thuộc Course, BR-154).
   * null = không biết cây Module (chỉ bản giả), khi đó người gọi chấp nhận mọi moduleId.
   * Ném NotFoundException khi Course không tồn tại, ServiceUnavailableException khi không gọi được course-service.
   */
  abstract getModuleIds(
    courseId: string,
    user: CurrentUser,
  ): Promise<string[] | null>;
}
