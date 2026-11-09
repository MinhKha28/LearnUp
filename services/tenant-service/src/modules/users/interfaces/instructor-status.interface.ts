import type { IManagedCourseChain } from '../../../infrastructure/clients/course/interfaces/managed-course-chain.interface';

/** UC12.5: Instructor nhận được chuỗi Course (cùng tổ chức, đã kích hoạt, Active, không phải người bị vô hiệu hóa). */
export interface IStatusChangeReceiver {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
}

export type DeactivationBlockReason =
  | 'ACCOUNT_NOT_ACTIVATED'
  | 'ALREADY_DEACTIVATED'
  | 'NO_VALID_RECEIVER'
  | 'COURSE_SERVICE_UNAVAILABLE';

/** UC12.5: dữ liệu cho modal vô hiệu hóa (GET instructors/:id/status-change). */
export interface IInstructorStatusChange {
  id: string;
  status: string;
  activated: boolean;
  canDeactivate: boolean;
  blockReason: DeactivationBlockReason | null;
  /** Chuỗi đang phụ trách; null khi không hỏi được course-service. */
  courses: IManagedCourseChain[] | null;
  /** Chỉ có khi còn chuỗi cần chuyển; sắp theo họ tên. */
  receivers: IStatusChangeReceiver[];
}

/** BR-51: phần chung của modal vô hiệu hóa (UC12.5) và dialog xóa (UC12.6). */
export type HandOverBlockReason =
  'NO_VALID_RECEIVER' | 'COURSE_SERVICE_UNAVAILABLE';

export interface IHandOverPreview {
  courses: IManagedCourseChain[] | null;
  receivers: IStatusChangeReceiver[];
  blockReason: HandOverBlockReason | null;
}

/** UC12.5: kết quả PATCH instructors/:id/status. changed = false: đã ở trạng thái đích (bấm lặp). */
export interface IInstructorStatusResult {
  id: string;
  status: string;
  changed: boolean;
  transferredCourses: IManagedCourseChain[];
  receiver: { id: string; fullName: string } | null;
}
