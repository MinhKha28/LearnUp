/** UC10.1: kết quả thanh toán gia hạn. */
export interface IRenewalResult {
  paymentId: string;
  paymentStatus: 'Succeeded' | 'Failed';
  failureReason?: string | null;
  subscription?: {
    id: string;
    status: string;
    startsAt: Date;
    expiresAt: Date;
  };
}
