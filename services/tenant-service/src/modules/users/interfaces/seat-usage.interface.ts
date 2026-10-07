// Số chỗ tài khoản theo Subscription hiện hành (UC12.2 Instructor, sau này UC13.2 Learner). BR-23.
export interface SeatUsage {
  // Tài khoản chưa xóa của role, mọi trạng thái (BR-36: vô hiệu hóa không giải phóng chỗ; BR-37).
  used: number;
  // Bản chụp giới hạn trên Subscription hiện hành; không có Subscription hiện hành -> 0.
  max: number;
  remaining: number;
  // Active | Grace | Suspended, null khi không có Subscription hiện hành.
  subscriptionStatus: string | null;
  // Tổ chức Active && Subscription Active && remaining > 0 (BR-15, BR-17, BR-45).
  canCreate: boolean;
}
