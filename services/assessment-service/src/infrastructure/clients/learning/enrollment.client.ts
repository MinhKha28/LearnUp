import type { CurrentUser } from '@learnup/ts-common';

export interface EnrolledCourse {
  courseId: string;
  enrollmentId: string;
  /**
   * Trạng thái Enrollment ở learning-service (NotStarted, InProgress, Completed...). Chưa bắt buộc: learning-service
   * bản cũ không trả. Khi có thì nó quyết định Enrollment đã Completed chưa (BR-169); khi không có thì xem bảng
   * completed_enrollments (xem isEnrollmentCompleted trong learner-access.ts).
   */
  status?: string;
}

/**
 * Hỏi learning-service những điều assessment-service không sở hữu: Learner có đang Enroll một Course không
 * (UC29, UC30). Cần câu trả lời ngay nên dùng REST, không dùng Kafka (ADR 0004).
 *
 * Bản dùng thật: HttpEnrollmentClient. Bản giả: FakeEnrollmentClient.
 * Chọn bằng ENROLLMENT_CLIENT_MODE=http|fake (integrations.module.ts); mặc định là http.
 */
export abstract class EnrollmentClient {
  /**
   * Enrollment (chưa Withdrawn) của Learner trong một Course, hoặc null khi Learner chưa Enroll.
   * Ném ServiceUnavailableException khi không gọi được learning-service.
   */
  abstract findEnrollment(
    courseId: string,
    user: CurrentUser,
  ): Promise<EnrolledCourse | null>;

  /**
   * BR-119: tell learning-service that the Learner has done something that counts as learning data (a submission or, later,
   * the start of a Quiz attempt), so a NotStarted Enrollment becomes InProgress. Learning-service changes nothing when
   * the Enrollment has started already, so telling it again is harmless.
   * Ném ServiceUnavailableException khi không gọi được; người gọi chỉ ghi log, không để việc này làm hỏng thao tác của Learner.
   */
  abstract reportLearningActivity(
    enrollmentId: string,
    occurredAt: Date,
    user: CurrentUser,
  ): Promise<void>;
}
