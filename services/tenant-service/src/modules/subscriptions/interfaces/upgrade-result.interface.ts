/** UC10.2: NotRequired là số tiền không dương, gói mới áp dụng ngay và không tạo Payment (BR-19). */
export interface IUpgradeResult {
  paymentId: string | null;
  paymentStatus: 'Succeeded' | 'Failed' | 'NotRequired';
  amount: number;
  failureReason?: string | null;
  subscription?: {
    id: string;
    planName: string;
    status: string;
    startsAt: Date;
    expiresAt: Date;
  };
}
