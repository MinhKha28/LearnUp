import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { EnrolledCourse, EnrollmentClient } from './enrollment.client';

/**
 * Bản giả để chạy và thử assessment-service khi chưa bật learning-service (ENROLLMENT_CLIENT_MODE=fake).
 *
 * CẢNH BÁO: mọi Learner đều coi như đã Enroll mọi Course, nên kiểm tra Enrollment của UC29/UC30 không còn tác dụng.
 * Chỉ dùng khi dev/test, không bao giờ dùng ở môi trường thật.
 * Mã Enrollment giả cố định theo (Learner, Course), để thử được việc Course đã Completed (bảng completed_enrollments).
 */
export class FakeEnrollmentClient extends EnrollmentClient {
  constructor() {
    super();
    new Logger(FakeEnrollmentClient.name).warn(
      '[FAKE] ENROLLMENT_CLIENT_MODE=fake: không gọi learning-service, mọi Learner coi như đã Enroll mọi Course.',
    );
  }

  findEnrollment(
    courseId: string,
    user: CurrentUser,
  ): Promise<EnrolledCourse | null> {
    return Promise.resolve({
      courseId,
      enrollmentId: fakeEnrollmentId(user.userId, courseId),
    });
  }
}

/** UUID ổn định tính từ (Learner, Course); đủ để dùng làm khóa trong completed_enrollments khi thử. */
export function fakeEnrollmentId(learnerId: string, courseId: string): string {
  const h = createHash('sha1').update(`${learnerId}:${courseId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
