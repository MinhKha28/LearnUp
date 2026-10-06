/** Bộ đếm thư đăng ký theo email trong khung 24 giờ (BR-32, BR-276). */
export interface IResendCounter {
  resendCount: number;
  resendWindowStartedAt: Date;
}
