export interface IUsageItem {
  used: number | null;
  limit: number;
  percent: number | null;
  warning: boolean;
}

export interface ICurrentSubscription {
  id: string;
  planName: string;
  price: number;
  status: string;
  startsAt: Date;
  expiresAt: Date;
  graceEndsAt: Date | null;
  readOnlyEndsAt: Date | null;
  daysRemaining: number;
}

export interface IScheduledRenewal {
  planName: string;
  startsAt: Date;
  expiresAt: Date;
}

export interface ISubscriptionOverview {
  organizationName: string;
  subscription: ICurrentSubscription | null;
  scheduledRenewal: IScheduledRenewal | null;
  usageWarningThresholdPercent: number;
  graceDays: number;
  organizerReadOnlyDays: number;
  courseUsageAvailable: boolean;
  usage: {
    learners: IUsageItem;
    instructors: IUsageItem;
    courses: IUsageItem;
    storageBytes: IUsageItem;
  };
}
