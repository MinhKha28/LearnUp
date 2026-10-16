/**
 * DỮ LIỆU GIẢ – dùng khi course-service chưa có endpoint đếm Course theo Instructor
 * (COURSE_CLIENT_MODE=fake, mặc định).
 *
 * Endpoint thật mà course-service cần cung cấp:
 *   POST /api/v1/internal/course-chains/count-by-instructors
 *   Header: x-internal-key, x-user-id, x-organization-id, x-user-role
 *   Body:   { instructorIds: string[] }
 *   200:    data = { counts: { [instructorId]: number } }  — đếm dòng course_chains
 *           có instructor_id thuộc danh sách VÀ organization_id = x-organization-id.
 *
 * Cách chuyển sang dùng thật khi course-service có endpoint:
 *   COURSE_CLIENT_MODE=http, COURSE_SERVICE_URL=http://localhost:8083
 *   (tùy chọn COURSE_SERVICE_TIMEOUT_MS, mặc định 3000). Không phải sửa code nghiệp vụ.
 */
import type { CurrentUser } from '@learnup/ts-common';
import { CourseServiceClient } from './course-service.client';
import type { IOrganizationCourseUsage } from './interfaces/organization-course-usage.interface';

// ID khớp prisma/seed-account-management.ts. Instructor không có trong bảng -> 0.
const FAKE_COUNTS: Record<string, number> = {
  '01900000-0000-7000-8000-00000000a101': 2, // Trần Văn Minh (ABC)
  '01900000-0000-7000-8000-00000000a102': 1, // Nguyễn Thị Hương (ABC)
  '01900000-0000-7000-8000-00000000a103': 1, // Lê Hoàng Nam (ABC)
  '01900000-0000-7000-8000-00000000a105': 1, // Võ Thị Thu Hà (ABC)
  '01900000-0000-7000-8000-00000000a114': 3, // Đinh Văn Long (ABC)
  '01900000-0000-7000-8000-00000000b101': 1, // Hồ Văn Khoa (XYZ)
};

export class FakeCourseServiceClient extends CourseServiceClient {
  countCourseChainsByInstructors(
    _user: CurrentUser,
    instructorIds: string[],
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const id of instructorIds) counts[id] = FAKE_COUNTS[id] ?? 0;
    return Promise.resolve(counts);
  }

  getOrganizationUsage(): Promise<IOrganizationCourseUsage> {
    return Promise.resolve({ courseChains: 0, storageBytes: 0 });
  }
}
