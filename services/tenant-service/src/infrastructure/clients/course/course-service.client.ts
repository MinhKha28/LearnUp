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

  /**
   * UC12.5 (BR-41, BR-287): chuyển MỌI chuỗi Course fromInstructorId đang phụ trách sang
   * toInstructorId, trong tổ chức của người gọi. Idempotent: gọi lại khi đã chuyển hết thì trả [].
   * Trả các chuỗi vừa chuyển. tenant đã kiểm người tiếp nhận hợp lệ trước khi gọi.
   * Lỗi / timeout thì ném lỗi: bên course có thể đã chuyển một phần hoặc toàn bộ, gọi lại để chuyển nốt.
   */
  abstract transferCourseChains(
    user: CurrentUser,
    fromInstructorId: string,
    toInstructorId: string,
  ): Promise<IManagedCourseChain[]>;

  abstract getOrganizationUsage(
    user: CurrentUser,
  ): Promise<IOrganizationCourseUsage>;

  /**
   * UC44.1: số chuỗi Course và dung lượng đã dùng của một tổ chức bất kỳ, hỏi thay Admin nền tảng
   * (Admin không thuộc tổ chức nào nên không dùng được getOrganizationUsage). Lỗi thì ném lỗi.
   */
  abstract getOrganizationUsageById(
    organizationId: string,
  ): Promise<IOrganizationCourseUsage>;
}
