import type { SeatUsage } from './seat-usage.interface';

/** UC13.6: kết quả DELETE learners/:id. changed = false: tài khoản đã bị xóa từ trước (cùng tổ chức). */
export interface ILearnerDeletionResult {
  id: string;
  changed: boolean;
  /** Số chỗ Learner sau khi xóa (BR-23, BR-37: xóa giải phóng chỗ). */
  seats: SeatUsage;
}
