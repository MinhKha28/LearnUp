import type { CurrentUser } from '@learnup/ts-common';

/**
 * Điều Enrollment cho phép làm với Quiz và Assignment của Course (learning-service tính từ trạng thái Enrollment):
 *  - Full: được làm (NotStarted, InProgress kể cả quá hạn, Exempted);
 *  - ReadOnly: chỉ xem (Completed, BR-210);
 *  - None: không truy cập (Halted, Withdrawn).
 */
export type AssessmentAccessLevel = 'Full' | 'ReadOnly' | 'None';

/**
 * Trạng thái Enrollment learning-service lưu (không có Overdue) và quyền tương ứng. Câu trả lời mâu thuẫn với bảng này
 * (ví dụ Completed + Full) bị từ chối, để không cho ghi nhầm.
 */
export const ACCESS_OF_STATUS: Readonly<Record<string, AssessmentAccessLevel>> = {
  NotStarted: 'Full',
  InProgress: 'Full',
  Exempted: 'Full',
  Completed: 'ReadOnly',
  Halted: 'None',
  Withdrawn: 'None',
};

export interface AssessmentAccess {
  enrollmentId: string;
  /** Trạng thái Enrollment đang lưu ở learning-service (không tính Overdue). */
  status: string;
  access: AssessmentAccessLevel;
}

/**
 * Hỏi learning-service những điều assessment-service không sở hữu: Enrollment của Learner trên một Course cho làm bài
 * đến đâu (UC29, UC30). Cần câu trả lời ngay nên dùng REST, không dùng Kafka (ADR 0004).
 *
 * Bản dùng thật: HttpEnrollmentClient. Bản giả: FakeEnrollmentClient.
 * Chọn bằng ENROLLMENT_CLIENT_MODE=http|fake (integrations.module.ts); mặc định là http.
 */
export abstract class EnrollmentClient {
  /**
   * Quyền làm bài của Learner trên một Course (id phiên bản Course), hoặc null khi Learner chưa Enroll Course này.
   * Ném ServiceUnavailableException khi không gọi được learning-service hoặc câu trả lời không dùng được: assessment
   * chặn thao tác, không cho qua khi chưa biết trạng thái.
   */
  abstract getAssessmentAccess(
    courseId: string,
    user: CurrentUser,
  ): Promise<AssessmentAccess | null>;
}
