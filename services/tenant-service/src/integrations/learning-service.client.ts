import type { CurrentUser } from '@learnup/ts-common';

/** Tình trạng tham gia đào tạo của một Learner (UC13). */
export interface LearnerEnrollmentSummary {
  // Enrollment đang dở: NotStarted + InProgress (kể cả đang quá hạn), cả Required lẫn Optional.
  activeCourseCount: number;
  // Enrollment Required đang quá hạn, tính lúc đọc (BR-144, BR-129); tài khoản vô hiệu hóa = 0 (BR-38).
  overdueCourseCount: number;
}

/**
 * Hỏi learning-service tình trạng tham gia đào tạo của các Learner.
 * tenant-service KHÔNG đọc learning_db và KHÔNG chép số này về (thiết kế tenant_db mục 4).
 *
 * Bản dùng thật: HttpLearningServiceClient. Bản giả: FakeLearningServiceClient.
 * Chọn bằng LEARNING_CLIENT_MODE=http|fake (integrations.module.ts).
 *
 * Abstract class (không phải interface) để dùng trực tiếp làm token DI.
 */
export abstract class LearningServiceClient {
  /**
   * Gọi MỘT lần cho cả trang. Trả map learnerId -> tình trạng đào tạo.
   * Learner không có trong kết quả = không có Enrollment (bên gọi coi là 0).
   * Lỗi mạng / timeout / lỗi learning-service thì ném lỗi; bên gọi tự quyết định xử lý.
   */
  abstract summarizeEnrollmentsByLearners(
    user: CurrentUser,
    learnerIds: string[],
  ): Promise<Record<string, LearnerEnrollmentSummary>>;
}
