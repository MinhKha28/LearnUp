import type { IManagedCourseChain } from '../../../infrastructure/clients/course/interfaces/managed-course-chain.interface';
import type {
  HandOverBlockReason,
  IStatusChangeReceiver,
} from './instructor-status.interface';
import type { SeatUsage } from './seat-usage.interface';

/** UC12.6: dữ liệu cho dialog xóa (GET instructors/:id/deletion). Mọi trạng thái đều xóa được (BR-46). */
export interface IInstructorDeletion {
  id: string;
  status: string;
  activated: boolean;
  canDelete: boolean;
  blockReason: HandOverBlockReason | null;
  /** Chuỗi đang phụ trách; null khi không hỏi được course-service. */
  courses: IManagedCourseChain[] | null;
  /** Chỉ có khi còn chuỗi cần chuyển; sắp theo họ tên. */
  receivers: IStatusChangeReceiver[];
}

/** UC12.6: kết quả DELETE instructors/:id. changed = false: tài khoản đã bị xóa từ trước (cùng tổ chức). */
export interface IInstructorDeletionResult {
  id: string;
  changed: boolean;
  transferredCourses: IManagedCourseChain[];
  receiver: { id: string; fullName: string } | null;
  /** Số chỗ Instructor sau khi xóa (BR-31, BR-46: xóa giải phóng chỗ). */
  seats: SeatUsage;
}
