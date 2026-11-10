/**
 * DỮ LIỆU GIẢ – dùng khi chưa bật learning-service thật (LEARNING_CLIENT_MODE=fake, mặc định).
 *
 * Endpoint thật của learning-service (Hào):
 *   POST /api/v1/internal/enrollments/summary-by-learners          (UC13 – learning-service ĐÃ có)
 *   Header: x-internal-key, x-user-id, x-organization-id, x-user-role
 *   Body:   { learnerIds: string[] }
 *   200:    data = { summaries: { [learnerId]: { activeCourseCount: number, overdueCourseCount: number } } }
 *   Cách đếm (chỉ Enrollment có organization_id = x-organization-id):
 *     - activeCourseCount  = status NotStarted + InProgress (kể cả đang quá hạn), Required lẫn Optional.
 *     - overdueCourseCount = Required, NotStarted/InProgress, due_at <= now(), không có lần tạm khóa
 *       tổ chức đang mở bắt đầu trước due_at (BR-144, BR-300; dùng lại enrollmentDisplayStatusSql()),
 *       và tài khoản không bị vô hiệu hóa (learner_accounts.deactivated_at IS NULL, BR-38).
 *       Exempted, Halted, Optional (BR-129: không có hạn) không bao giờ tính quá hạn.
 *
 *   GET /api/v1/internal/enrollments/by-learner/:learnerId           (UC13.1 – CHƯA có)
 *   Header: như trên
 *   200:    data = { enrollments: LearnerEnrollment[] } — xem http-learning-service.client.ts.
 *
 * Cách chuyển sang dùng thật:
 *   LEARNING_CLIENT_MODE=http, LEARNING_SERVICE_URL=http://localhost:8085
 *   (tùy chọn LEARNING_SERVICE_TIMEOUT_MS, mặc định 3000). Không phải sửa code nghiệp vụ.
 */
import type { CurrentUser } from '@learnup/ts-common';
import {
  LearnerEnrollment,
  LearnerEnrollmentSummary,
  LearningServiceClient,
} from './learning-service.client';

const id = (suffix: string) =>
  `01900000-0000-7000-8000-${suffix.padStart(12, '0')}`;

type FakeCourse = {
  courseId: string;
  name: string;
  versionNumber: number;
  requiredMaterials: number;
};

// Phiên bản Course giả. ID và tên khớp FAKE_CHAINS của fake-course-service.client.ts;
// f011 – f014 là phiên bản cũ / Course riêng của bảng này (BR-108: nhiều phiên bản cùng chuỗi).
const COURSES = {
  atld1: c('f011', 'An toàn lao động cơ bản', 1, 6),
  atld2: c('f001', 'An toàn lao động cơ bản', 2, 8),
  knpv: c('f003', 'Kỹ năng phỏng vấn tuyển dụng', 1, 5),
  pccc: c('f005', 'Phòng cháy chữa cháy', 1, 4),
  bttb2: c('f013', 'Bảo trì thiết bị điện', 2, 6),
  bttb3: c('f006', 'Bảo trì thiết bị điện', 3, 7),
  qtkt: c('f007', 'Quy trình kiểm tra chất lượng', 1, 5),
  dbv1: c('f012', 'Đọc bản vẽ kỹ thuật', 1, 4),
  dbv2: c('f008', 'Đọc bản vẽ kỹ thuật', 2, 6),
  dhnv: c('f009', 'Định hướng nhân viên mới', 1, 3), // XYZ
  attt: c('f014', 'An toàn thông tin cơ bản', 1, 5), // XYZ
};

function c(
  suffix: string,
  name: string,
  versionNumber: number,
  requiredMaterials: number,
): FakeCourse {
  return { courseId: id(suffix), name, versionNumber, requiredMaterials };
}

/**
 * Viết gọn một Enrollment. `no` là số thứ tự trong Learner (sinh id Enrollment).
 * Required: start = assignedAt = enrolledAt, due = dueAt. Optional: start = enrolledAt, không có hạn.
 * Completed: hoàn thành đủ học liệu, completedAt = done.
 */
const e = (
  learner: string,
  no: number,
  course: FakeCourse,
  enrollmentType: 'Required' | 'Optional',
  status: string,
  dates: { start: string; due?: string; done?: string },
  completed = 0,
): LearnerEnrollment => ({
  enrollmentId: id(`d${learner}${no}`),
  courseId: course.courseId,
  course: { name: course.name, versionNumber: course.versionNumber },
  enrollmentType,
  status,
  enrolledAt: new Date(dates.start),
  assignedAt: enrollmentType === 'Required' ? new Date(dates.start) : null,
  dueAt:
    enrollmentType === 'Required' && dates.due ? new Date(dates.due) : null,
  completedAt: dates.done ? new Date(dates.done) : null,
  requiredMaterials: {
    completed: status === 'Completed' ? course.requiredMaterials : completed,
    total: course.requiredMaterials,
  },
});

// UC13.1: Enrollment giả theo Learner, ID khớp prisma/seed-account-management.ts.
// Không có Withdrawn (endpoint thật loại bỏ). Ngày tính theo mốc demo 20/10/2026:
// Overdue = Required chưa xong và đã qua hạn.
const { atld1, atld2, knpv, pccc, bttb2, bttb3, qtkt, dbv1, dbv2, dhnv, attt } =
  COURSES;
const FAKE_ROWS: Record<string, LearnerEnrollment[]> = {
  a201: [
    e(
      'a201',
      1,
      atld2,
      'Required',
      'Overdue',
      { start: '2026-09-10T02:00:00Z', due: '2026-10-10T02:00:00Z' },
      5,
    ),
    e(
      'a201',
      2,
      pccc,
      'Required',
      'InProgress',
      { start: '2026-10-06T02:00:00Z', due: '2026-11-05T02:00:00Z' },
      1,
    ),
    e('a201', 3, knpv, 'Optional', 'NotStarted', {
      start: '2026-10-12T02:00:00Z',
    }),
    e('a201', 4, dbv2, 'Required', 'Completed', {
      start: '2026-09-05T02:00:00Z',
      due: '2026-10-05T02:00:00Z',
      done: '2026-09-28T09:00:00Z',
    }),
  ],
  a202: [
    e(
      'a202',
      1,
      atld2,
      'Required',
      'InProgress',
      { start: '2026-10-03T02:00:00Z', due: '2026-11-02T02:00:00Z' },
      3,
    ),
    e(
      'a202',
      2,
      knpv,
      'Optional',
      'InProgress',
      { start: '2026-10-08T02:00:00Z' },
      2,
    ),
  ],
  a203: [
    e('a203', 1, pccc, 'Optional', 'NotStarted', {
      start: '2026-10-15T02:00:00Z',
    }),
    e('a203', 2, bttb3, 'Required', 'Exempted', {
      start: '2026-10-01T02:00:00Z',
      due: '2026-10-31T02:00:00Z',
    }),
  ],
  a206: [
    e(
      'a206',
      1,
      atld2,
      'Required',
      'Overdue',
      { start: '2026-09-05T02:00:00Z', due: '2026-10-05T02:00:00Z' },
      2,
    ),
    e('a206', 2, bttb3, 'Required', 'Overdue', {
      start: '2026-09-15T02:00:00Z',
      due: '2026-10-15T02:00:00Z',
    }),
    e('a206', 3, pccc, 'Required', 'NotStarted', {
      start: '2026-10-11T02:00:00Z',
      due: '2026-11-10T02:00:00Z',
    }),
    e(
      'a206',
      4,
      knpv,
      'Optional',
      'InProgress',
      { start: '2026-10-02T02:00:00Z' },
      4,
    ),
    // Course bị vô hiệu hóa giữa chừng -> Tạm dừng.
    e(
      'a206',
      5,
      qtkt,
      'Required',
      'Halted',
      { start: '2026-09-01T02:00:00Z', due: '2026-10-01T02:00:00Z' },
      1,
    ),
  ],
  a208: [
    e(
      'a208',
      1,
      dbv2,
      'Required',
      'InProgress',
      { start: '2026-10-02T02:00:00Z', due: '2026-11-01T02:00:00Z' },
      2,
    ),
    e('a208', 2, bttb3, 'Optional', 'NotStarted', {
      start: '2026-10-14T02:00:00Z',
    }),
  ],
  // Deactivated: dòng vẫn hiện Overdue nhưng không tính vào thống kê quá hạn (BR-38).
  a209: [
    e(
      'a209',
      1,
      atld2,
      'Required',
      'Overdue',
      { start: '2026-09-08T02:00:00Z', due: '2026-10-08T02:00:00Z' },
      1,
    ),
    e(
      'a209',
      2,
      knpv,
      'Optional',
      'InProgress',
      { start: '2026-09-20T02:00:00Z' },
      1,
    ),
  ],
  a210: [
    e('a210', 1, pccc, 'Required', 'Overdue', {
      start: '2026-09-12T02:00:00Z',
      due: '2026-10-12T02:00:00Z',
    }),
    e('a210', 2, atld1, 'Required', 'Completed', {
      start: '2026-08-20T02:00:00Z',
      due: '2026-09-19T02:00:00Z',
      done: '2026-09-15T08:00:00Z',
    }),
  ],
  // Chỉ có Enrollment đã xong: danh sách UC13 vẫn hiện 0 / 0.
  a212: [
    e('a212', 1, knpv, 'Optional', 'Completed', {
      start: '2026-09-10T02:00:00Z',
      done: '2026-10-02T10:00:00Z',
    }),
  ],
  a214: [
    e(
      'a214',
      1,
      atld2,
      'Required',
      'Overdue',
      { start: '2026-09-14T02:00:00Z', due: '2026-10-14T02:00:00Z' },
      6,
    ),
    e(
      'a214',
      2,
      pccc,
      'Required',
      'InProgress',
      { start: '2026-09-30T02:00:00Z', due: '2026-10-30T02:00:00Z' },
      2,
    ),
    e('a214', 3, dbv2, 'Required', 'NotStarted', {
      start: '2026-10-16T02:00:00Z',
      due: '2026-11-15T02:00:00Z',
    }),
    e(
      'a214',
      4,
      knpv,
      'Optional',
      'InProgress',
      { start: '2026-10-05T02:00:00Z' },
      1,
    ),
    e('a214', 5, bttb3, 'Optional', 'NotStarted', {
      start: '2026-10-18T02:00:00Z',
    }),
    e('a214', 6, qtkt, 'Optional', 'Completed', {
      start: '2026-08-25T02:00:00Z',
      done: '2026-09-12T07:00:00Z',
    }),
  ],
  a215: [
    e('a215', 1, atld2, 'Required', 'NotStarted', {
      start: '2026-10-21T02:00:00Z',
      due: '2026-11-20T02:00:00Z',
    }),
  ],
  a216: [
    e(
      'a216',
      1,
      bttb3,
      'Required',
      'InProgress',
      { start: '2026-10-04T02:00:00Z', due: '2026-11-03T02:00:00Z' },
      3,
    ),
    e(
      'a216',
      2,
      pccc,
      'Required',
      'InProgress',
      { start: '2026-10-09T02:00:00Z', due: '2026-11-08T02:00:00Z' },
      2,
    ),
    e('a216', 3, knpv, 'Optional', 'NotStarted', {
      start: '2026-10-17T02:00:00Z',
    }),
    e('a216', 4, dbv1, 'Required', 'Completed', {
      start: '2026-08-15T02:00:00Z',
      due: '2026-09-14T02:00:00Z',
      done: '2026-09-10T03:00:00Z',
    }),
  ],
  // Deactivated.
  a217: [
    e(
      'a217',
      1,
      pccc,
      'Required',
      'InProgress',
      { start: '2026-10-13T02:00:00Z', due: '2026-11-12T02:00:00Z' },
      1,
    ),
  ],
  a218: [
    e(
      'a218',
      1,
      bttb3,
      'Required',
      'Overdue',
      { start: '2026-09-18T02:00:00Z', due: '2026-10-18T02:00:00Z' },
      4,
    ),
    e(
      'a218',
      2,
      atld2,
      'Optional',
      'InProgress',
      { start: '2026-10-01T02:00:00Z' },
      2,
    ),
  ],
  a219: [
    e(
      'a219',
      1,
      pccc,
      'Optional',
      'InProgress',
      { start: '2026-10-07T02:00:00Z' },
      3,
    ),
  ],
  // Nhiều phiên bản của cùng chuỗi (BR-298, BR-108): ATLĐ v1 + v2, Bảo trì v2 + v3.
  a221: [
    e(
      'a221',
      1,
      atld2,
      'Required',
      'Overdue',
      { start: '2026-09-11T02:00:00Z', due: '2026-10-11T02:00:00Z' },
      4,
    ),
    e(
      'a221',
      2,
      bttb3,
      'Required',
      'Overdue',
      { start: '2026-09-16T02:00:00Z', due: '2026-10-16T02:00:00Z' },
      2,
    ),
    e('a221', 3, dbv2, 'Required', 'Overdue', {
      start: '2026-09-19T02:00:00Z',
      due: '2026-10-19T02:00:00Z',
    }),
    e(
      'a221',
      4,
      pccc,
      'Required',
      'InProgress',
      { start: '2026-09-28T02:00:00Z', due: '2026-10-28T02:00:00Z' },
      1,
    ),
    e('a221', 5, knpv, 'Optional', 'NotStarted', {
      start: '2026-10-10T02:00:00Z',
    }),
    e(
      'a221',
      6,
      bttb2,
      'Optional',
      'InProgress',
      { start: '2026-09-25T02:00:00Z' },
      3,
    ),
    e('a221', 7, atld1, 'Required', 'Completed', {
      start: '2026-08-12T02:00:00Z',
      due: '2026-09-11T02:00:00Z',
      done: '2026-09-09T04:00:00Z',
    }),
    e('a221', 8, qtkt, 'Required', 'Exempted', {
      start: '2026-09-02T02:00:00Z',
      due: '2026-10-02T02:00:00Z',
    }),
  ],
  a222: [
    e('a222', 1, dbv2, 'Required', 'NotStarted', {
      start: '2026-10-19T02:00:00Z',
      due: '2026-11-18T02:00:00Z',
    }),
    e(
      'a222',
      2,
      pccc,
      'Optional',
      'InProgress',
      { start: '2026-10-06T02:00:00Z' },
      1,
    ),
  ],
  a224: [
    e('a224', 1, atld2, 'Optional', 'NotStarted', {
      start: '2026-10-16T02:00:00Z',
    }),
  ],
  b201: [
    e(
      'b201',
      1,
      dhnv,
      'Required',
      'Overdue',
      { start: '2026-09-09T02:00:00Z', due: '2026-10-09T02:00:00Z' },
      1,
    ),
    e(
      'b201',
      2,
      attt,
      'Optional',
      'InProgress',
      { start: '2026-10-04T02:00:00Z' },
      2,
    ),
  ],
  b202: [
    e(
      'b202',
      1,
      dhnv,
      'Required',
      'InProgress',
      { start: '2026-10-07T02:00:00Z', due: '2026-11-06T02:00:00Z' },
      1,
    ),
  ],
};

// Nhóm 1 của UC26: Required chưa xong (gồm Overdue).
const ACTIVE_STATUSES = new Set(['NotStarted', 'InProgress', 'Overdue']);
const isRequiredUnfinished = (row: LearnerEnrollment) =>
  row.enrollmentType === 'Required' && ACTIVE_STATUSES.has(row.status);

/**
 * Thứ tự như UC26 (D22): nhóm 1 theo hạn tăng dần; còn lại theo COALESCE(assignedAt, enrolledAt)
 * giảm dần; cuối cùng id giảm dần.
 */
const byUc26Order = (a: LearnerEnrollment, b: LearnerEnrollment): number => {
  const groupA = isRequiredUnfinished(a) ? 0 : 1;
  const groupB = isRequiredUnfinished(b) ? 0 : 1;
  if (groupA !== groupB) return groupA - groupB;
  const diff =
    groupA === 0
      ? (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0)
      : (b.assignedAt ?? b.enrolledAt).getTime() -
        (a.assignedAt ?? a.enrolledAt).getTime();
  return diff !== 0 ? diff : b.enrollmentId.localeCompare(a.enrollmentId);
};

const FAKE_ENROLLMENTS: Record<string, LearnerEnrollment[]> =
  Object.fromEntries(
    Object.entries(FAKE_ROWS).map(([learner, rows]) => [
      id(learner),
      [...rows].sort(byUc26Order),
    ]),
  );

// Learner Deactivated trong seed (a209, a217): overdueCourseCount = 0 (BR-38).
const DEACTIVATED_LEARNERS = new Set([id('a209'), id('a217')]);

// UC13: số liệu danh sách sinh từ FAKE_ENROLLMENTS để danh sách khớp trang chi tiết.
// Learner không có trong bảng -> 0 / 0.
const FAKE_SUMMARIES: Record<string, LearnerEnrollmentSummary> =
  Object.fromEntries(
    Object.entries(FAKE_ENROLLMENTS).map(([learnerId, rows]) => [
      learnerId,
      {
        activeCourseCount: rows.filter((row) => ACTIVE_STATUSES.has(row.status))
          .length,
        overdueCourseCount: DEACTIVATED_LEARNERS.has(learnerId)
          ? 0
          : rows.filter((row) => row.status === 'Overdue').length,
      },
    ]),
  );

export class FakeLearningServiceClient extends LearningServiceClient {
  summarizeEnrollmentsByLearners(
    _user: CurrentUser,
    learnerIds: string[],
  ): Promise<Record<string, LearnerEnrollmentSummary>> {
    // Learner không có Enrollment thì không có trong kết quả (bên gọi coi là 0).
    const summaries: Record<string, LearnerEnrollmentSummary> = {};
    for (const id of learnerIds) {
      if (FAKE_SUMMARIES[id]) summaries[id] = FAKE_SUMMARIES[id];
    }
    return Promise.resolve(summaries);
  }

  listEnrollmentsByLearner(
    _user: CurrentUser,
    learnerId: string,
  ): Promise<LearnerEnrollment[]> {
    // tenant đã kiểm Learner thuộc tổ chức người gọi trước khi hỏi.
    return Promise.resolve([...(FAKE_ENROLLMENTS[learnerId] ?? [])]);
  }
}
