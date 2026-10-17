export type SubscriptionStatus = "Active" | "Grace" | "Suspended";

export interface IUsageItem {
  used: number | null;
  limit: number;
  percent: number | null;
  warning: boolean;
}

export interface ISubscriptionOverview {
  organizationName: string;
  subscription: {
    id: string;
    planName: string;
    price: number;
    status: SubscriptionStatus;
    startsAt: string;
    expiresAt: string;
    graceEndsAt: string | null;
    readOnlyEndsAt: string | null;
    daysRemaining: number;
  } | null;
  scheduledRenewal: {
    planName: string;
    startsAt: string;
    expiresAt: string;
  } | null;
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
