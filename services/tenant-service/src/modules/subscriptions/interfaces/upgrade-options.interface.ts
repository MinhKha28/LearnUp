/** UC10.2: một gói đích kèm số tiền phải trả và các giới hạn không đạt (BR-18, BR-19, BR-21). */
export interface IUpgradeOption {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  maxLearners: number;
  maxInstructors: number;
  maxCourseChains: number;
  maxStorageBytes: number;
  amount: number;
  blockedBy: Array<{ limit: string; newLimit: number; required: number }>;
}

/** blockedReason khác null thì chưa nâng cấp được: Subscription không Active (BR-19) hoặc đã có kỳ gia hạn trước (BR-20). */
export interface IUpgradeOptions {
  currentPlanName: string;
  currentPrice: number;
  currentDurationDays: number;
  currentStatus: string;
  expiresAt: Date;
  remainingDays: number;
  blockedReason: string | null;
  usageAvailable: boolean;
  options: IUpgradeOption[];
}
