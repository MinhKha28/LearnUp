/**
 * DỮ LIỆU GIẢ – dùng khi course-service chưa có endpoint đếm / liệt kê Course theo Instructor
 * (COURSE_CLIENT_MODE=fake, mặc định).
 *
 * Endpoint thật mà course-service cần cung cấp:
 *   POST /api/v1/internal/course-chains/count-by-instructors          (UC12)
 *   Header: x-internal-key, x-user-id, x-organization-id, x-user-role
 *   Body:   { instructorIds: string[] }
 *   200:    data = { counts: { [instructorId]: number } }  — đếm dòng course_chains
 *           có instructor_id thuộc danh sách VÀ organization_id = x-organization-id.
 *
 *   GET /api/v1/internal/course-chains/by-instructor/:instructorId   (UC12.1)
 *   Header: như trên
 *   200:    data = { chains: IManagedCourseChain[] } — mỗi chuỗi một phần tử, xem http-course-service.client.ts.
 *
 * Cách chuyển sang dùng thật khi course-service có endpoint:
 *   COURSE_CLIENT_MODE=http, COURSE_SERVICE_URL=http://localhost:8083
 *   (tùy chọn COURSE_SERVICE_TIMEOUT_MS, mặc định 3000). Không phải sửa code nghiệp vụ.
 */
import type { CurrentUser } from '@learnup/ts-common';
import { CourseServiceClient } from './course-service.client';
import type { IManagedCourseChain } from './interfaces/managed-course-chain.interface';
import type { IOrganizationCourseUsage } from './interfaces/organization-course-usage.interface';

const id = (suffix: string) =>
  `01900000-0000-7000-8000-${suffix.padStart(12, '0')}`;

// UC12.1: chuỗi Course giả theo Instructor. ID Instructor khớp prisma/seed-account-management.ts.
// Phiên bản đại diện không bao giờ Archived (BR-287); Disabled vẫn giữ approvedAt (BR-336).
// Chuỗi chưa từng được duyệt (Draft, Submitted) có approvedAt = null.
const FAKE_CHAINS: Record<string, IManagedCourseChain[]> = {
  // Trần Văn Minh (ABC)
  [id('a101')]: [
    {
      chainId: id('e001'),
      courseId: id('f001'),
      name: 'An toàn lao động cơ bản',
      versionNumber: 2,
      status: 'Published',
      courseType: 'Private',
      approvedAt: new Date('2026-10-03T03:00:00Z'),
    },
    {
      chainId: id('e002'),
      courseId: id('f002'),
      name: 'Sơ cứu tại nơi làm việc',
      versionNumber: 1,
      status: 'Submitted',
      courseType: 'Public',
      approvedAt: null,
    },
  ],
  // Nguyễn Thị Hương (ABC)
  [id('a102')]: [
    {
      chainId: id('e003'),
      courseId: id('f003'),
      name: 'Kỹ năng phỏng vấn tuyển dụng',
      versionNumber: 1,
      status: 'Published',
      courseType: 'Public',
      approvedAt: new Date('2026-09-20T02:00:00Z'),
    },
  ],
  // Lê Hoàng Nam (ABC) – chuỗi chỉ có bản Draft
  [id('a103')]: [
    {
      chainId: id('e004'),
      courseId: id('f004'),
      name: 'Vận hành máy CNC',
      versionNumber: 1,
      status: 'Draft',
      courseType: 'Private',
      approvedAt: null,
    },
  ],
  // Võ Thị Thu Hà (ABC)
  [id('a105')]: [
    {
      chainId: id('e005'),
      courseId: id('f005'),
      name: 'Phòng cháy chữa cháy',
      versionNumber: 1,
      status: 'Published',
      courseType: 'Private',
      approvedAt: new Date('2026-09-25T04:00:00Z'),
    },
  ],
  // Đinh Văn Long (ABC)
  [id('a114')]: [
    {
      chainId: id('e006'),
      courseId: id('f006'),
      name: 'Bảo trì thiết bị điện',
      versionNumber: 3,
      status: 'Published',
      courseType: 'Private',
      approvedAt: new Date('2026-10-10T03:00:00Z'),
    },
    {
      // Bản hiện hành bị vô hiệu hóa vẫn là bản hiện hành (BR-336).
      chainId: id('e007'),
      courseId: id('f007'),
      name: 'Quy trình kiểm tra chất lượng',
      versionNumber: 1,
      status: 'Disabled',
      courseType: 'Public',
      approvedAt: new Date('2026-09-15T02:00:00Z'),
    },
    {
      // Có bản v3 đang Draft, nhưng bản hiện hành là v2 (ngày duyệt gần nhất).
      chainId: id('e008'),
      courseId: id('f008'),
      name: 'Đọc bản vẽ kỹ thuật',
      versionNumber: 2,
      status: 'Published',
      courseType: 'Private',
      approvedAt: new Date('2026-10-01T02:00:00Z'),
    },
  ],
  // Hồ Văn Khoa (XYZ)
  [id('b101')]: [
    {
      chainId: id('e009'),
      courseId: id('f009'),
      name: 'Định hướng nhân viên mới',
      versionNumber: 1,
      status: 'Published',
      courseType: 'Public',
      approvedAt: new Date('2026-09-18T02:00:00Z'),
    },
  ],
};

// UC12: số chuỗi sinh từ FAKE_CHAINS để cột Courses khớp trang chi tiết. Instructor không có trong bảng -> 0.
const FAKE_COUNTS: Record<string, number> = Object.fromEntries(
  Object.entries(FAKE_CHAINS).map(([instructorId, chains]) => [
    instructorId,
    chains.length,
  ]),
);

export class FakeCourseServiceClient extends CourseServiceClient {
  countCourseChainsByInstructors(
    _user: CurrentUser,
    instructorIds: string[],
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const id of instructorIds) counts[id] = FAKE_COUNTS[id] ?? 0;
    return Promise.resolve(counts);
  }

  listCourseChainsByInstructor(
    _user: CurrentUser,
    instructorId: string,
  ): Promise<IManagedCourseChain[]> {
    return Promise.resolve(FAKE_CHAINS[instructorId] ?? []);
  }

  getOrganizationUsage(): Promise<IOrganizationCourseUsage> {
    return Promise.resolve({ courseChains: 0, storageBytes: 0 });
  }
}
