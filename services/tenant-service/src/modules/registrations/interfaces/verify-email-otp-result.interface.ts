/** Nhập đúng mã (UC03): trả liên kết mở lại mới để Guest đi thẳng tới thanh toán (UC02.1). */
export interface IVerifyEmailOtpResult {
  paymentToken: string;
  registrationExpiresAt: Date;
}
