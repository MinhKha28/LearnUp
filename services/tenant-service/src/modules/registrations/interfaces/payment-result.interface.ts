export interface IPaymentResult {
  paymentId: string;
  paymentStatus: 'Succeeded' | 'Failed';
  failureReason?: string | null;
  subscription?: {
    id: string;
    startsAt: Date;
    expiresAt: Date;
  };
  organizerEmail?: string;
}
