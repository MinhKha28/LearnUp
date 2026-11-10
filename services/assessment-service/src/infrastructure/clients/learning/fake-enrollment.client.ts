import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { type AssessmentAccess, EnrollmentClient } from './enrollment.client';

/**
 * Bản giả để chạy và thử assessment-service khi chưa bật learning-service (ENROLLMENT_CLIENT_MODE=fake).
 *
 * CẢNH BÁO: mọi Learner đều coi như đã Enroll mọi Course và được làm bài đầy đủ (Full), nên kiểm tra Enrollment của
 * UC29/UC30 không còn tác dụng. Chỉ dùng khi dev/test, không bao giờ dùng ở môi trường thật. Muốn thử Course đã
 * Completed hay Enrollment bị Halted thì dùng ENROLLMENT_CLIENT_MODE=http với một learning-service giả (xem
 * test/integration/harness.ts, startLearningStub).
 * Mã Enrollment giả cố định theo (Learner, Course).
 */
export class FakeEnrollmentClient extends EnrollmentClient {
  constructor() {
    super();
    new Logger(FakeEnrollmentClient.name).warn(
      '[FAKE] ENROLLMENT_CLIENT_MODE=fake: không gọi learning-service, mọi Learner coi như đã Enroll mọi Course (Full).',
    );
  }

  getAssessmentAccess(
    courseId: string,
    user: CurrentUser,
  ): Promise<AssessmentAccess | null> {
    return Promise.resolve({
      enrollmentId: fakeEnrollmentId(user.userId, courseId),
      status: 'InProgress',
      access: 'Full',
    });
  }
}

/** UUID ổn định tính từ (Learner, Course). */
export function fakeEnrollmentId(learnerId: string, courseId: string): string {
  const h = createHash('sha1').update(`${learnerId}:${courseId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
