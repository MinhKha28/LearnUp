import type { CurrentUser } from '@learnup/ts-common';

export interface EnrolledCourse {
  courseId: string;
  enrollmentId: string;
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
}
