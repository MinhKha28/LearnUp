export interface ChargeResult {
  success: boolean;
  providerReference: string | null; // mã giao dịch phía cổng thanh toán (thành công)
  failureReason: string | null; // lý do từ chối (thất bại)
}
