/**
 * DỮ LIỆU GIẢ – dùng khi learning-service chưa có endpoint thống kê Enrollment theo Learner
 * (LEARNING_CLIENT_MODE=fake, mặc định).
 *
 * Vì sao fake: learning-service (cổng 8085) đã chạy nhưng chưa có endpoint này, và seed của
 * learning-service dùng ID Learner khác tenant (0199a000-…), nên gọi thật cũng chưa ra số.
 *
 * Endpoint thật mà learning-service cần cung cấp (Hào):
 *   POST /api/v1/internal/enrollments/summary-by-learners
 *   Header: x-internal-key, x-user-id, x-organization-id, x-user-role
 *   Body:   { learnerIds: string[] }
 *   200:    data = { summaries: { [learnerId]: { activeCourseCount: number, overdueCourseCount: number } } }
 *   Cách đếm (chỉ Enrollment có organization_id = x-organization-id):
 *     - activeCourseCount  = status NotStarted + InProgress (kể cả đang quá hạn), Required lẫn Optional.
 *     - overdueCourseCount = Required, NotStarted/InProgress, due_at <= now(), không có lần tạm khóa
 *       tổ chức đang mở bắt đầu trước due_at (BR-144, BR-300; dùng lại enrollmentDisplayStatusSql()),
 *       và tài khoản không bị vô hiệu hóa (learner_accounts.deactivated_at IS NULL, BR-38).
 *       Exempted, Halted, Optional (BR-129: không có hạn) không bao giờ tính quá hạn.
 *     - Learner không có Enrollment -> bỏ qua (tenant coi là 0).
 *
 * Cách chuyển sang dùng thật khi learning-service có endpoint:
 *   LEARNING_CLIENT_MODE=http, LEARNING_SERVICE_URL=http://localhost:8085
 *   (tùy chọn LEARNING_SERVICE_TIMEOUT_MS, mặc định 3000). Không phải sửa code nghiệp vụ.
 */
import type { CurrentUser } from '@learnup/ts-common';
import {
  LearnerEnrollmentSummary,
  LearningServiceClient,
} from './learning-service.client';

// Viết gọn một dòng: s(activeCourseCount, overdueCourseCount).
const s = (
  activeCourseCount: number,
  overdueCourseCount: number,
): LearnerEnrollmentSummary => ({ activeCourseCount, overdueCourseCount });

// ID khớp prisma/seed-account-management.ts. Learner không có trong bảng -> 0 / 0.
// Learner bị vô hiệu hóa luôn có overdueCourseCount = 0 (BR-38).
const FAKE_SUMMARIES: Record<string, LearnerEnrollmentSummary> = {
  '01900000-0000-7000-8000-00000000a201': s(3, 1), // An (ABC)
  '01900000-0000-7000-8000-00000000a202': s(2, 0), // Bình (ABC)
  '01900000-0000-7000-8000-00000000a203': s(1, 0), // Cường (ABC)
  '01900000-0000-7000-8000-00000000a206': s(4, 2), // Bảo (ABC)
  '01900000-0000-7000-8000-00000000a208': s(2, 0), // Định (ABC)
  '01900000-0000-7000-8000-00000000a209': s(2, 0), // Giang (ABC, Deactivated)
  '01900000-0000-7000-8000-00000000a210': s(1, 1), // Hiếu (ABC)
  '01900000-0000-7000-8000-00000000a214': s(5, 1), // Lộc (ABC)
  '01900000-0000-7000-8000-00000000a215': s(1, 0), // Mỹ (ABC)
  '01900000-0000-7000-8000-00000000a216': s(3, 0), // Nghĩa (ABC)
  '01900000-0000-7000-8000-00000000a217': s(1, 0), // Oanh (ABC, Deactivated)
  '01900000-0000-7000-8000-00000000a218': s(2, 1), // Phúc (ABC)
  '01900000-0000-7000-8000-00000000a219': s(1, 0), // Quyên (ABC)
  '01900000-0000-7000-8000-00000000a221': s(6, 3), // Tâm (ABC)
  '01900000-0000-7000-8000-00000000a222': s(2, 0), // Thịnh (ABC)
  '01900000-0000-7000-8000-00000000a224': s(1, 0), // Vương (ABC)
  '01900000-0000-7000-8000-00000000b201': s(2, 1), // Hậu (XYZ)
  '01900000-0000-7000-8000-00000000b202': s(1, 0), // Thu (XYZ)
};

export class FakeLearningServiceClient extends LearningServiceClient {
  summarizeEnrollmentsByLearners(
    _user: CurrentUser,
    learnerIds: string[],
  ): Promise<Record<string, LearnerEnrollmentSummary>> {
    // Giống endpoint thật: Learner không có Enrollment thì không có trong kết quả.
    const summaries: Record<string, LearnerEnrollmentSummary> = {};
    for (const id of learnerIds) {
      if (FAKE_SUMMARIES[id]) summaries[id] = FAKE_SUMMARIES[id];
    }
    return Promise.resolve(summaries);
  }
}
