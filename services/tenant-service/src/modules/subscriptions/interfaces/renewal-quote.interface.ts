/** UC10.1: màn hình gia hạn hiển thị trước khi thanh toán (BR-4). */
export interface IRenewalQuote {
  planName: string;
  planOffered: boolean;
  currentStatus: string;
  price: number;
  durationDays: number;
  maxLearners: number;
  maxInstructors: number;
  maxCourseChains: number;
  maxStorageBytes: number;
  startsAt: Date;
  expiresAt: Date;
  scheduledRenewal: { startsAt: Date; expiresAt: Date } | null;
  usageAvailable: boolean;
  exceededLimits: Array<{ limit: string; used: number; newLimit: number }>;
}
