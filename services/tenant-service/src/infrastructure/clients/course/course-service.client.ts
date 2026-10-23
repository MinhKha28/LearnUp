import type { CurrentUser } from '@learnup/ts-common';
import type { IManagedCourseChain } from './interfaces/managed-course-chain.interface';
import type { IOrganizationCourseUsage } from './interfaces/organization-course-usage.interface';

/**
 * Hỏi course-service số chuỗi Course (course_chains) mỗi Instructor đang phụ trách.
 * tenant-service KHÔNG đọc course_db và KHÔNG chép số này về (thiết kế tenant_db mục 4).
 * BR-287: quyền phụ trách gắn với cả chuỗi phiên bản; BR-1: số Course đếm theo chuỗi.
 *
 * Bản dùng thật: HttpCourseServiceClient. Bản giả: FakeCourseServiceClient.
 * Chọn bằng COURSE_CLIENT_MODE=http|fake (integrations.module.ts).
 *
 * Abstract class (không phải interface) để dùng trực tiếp làm token DI.
 */
export abstract class CourseServiceClient {
  /**
   * Gọi MỘT lần cho cả trang. Trả map instructorId -> số chuỗi Course.
   * Lỗi mạng / timeout / lỗi course-service thì ném lỗi; bên gọi tự quyết định xử lý.
   */
  abstract countCourseChainsByInstructors(
    user: CurrentUser,
    instructorIds: string[],
  ): Promise<Record<string, number>>;

  /**
   * UC12.1: các chuỗi Course một Instructor đang phụ trách, mỗi chuỗi một phần tử.
   * Số phần tử phải bằng số countCourseChainsByInstructors trả về cho cùng Instructor.
   * Lỗi thì ném lỗi; bên gọi tự quyết định xử lý.
   */
  abstract listCourseChainsByInstructor(
    user: CurrentUser,
    instructorId: string,
  ): Promise<IManagedCourseChain[]>;

  abstract getOrganizationUsage(
    user: CurrentUser,
  ): Promise<IOrganizationCourseUsage>;
}
