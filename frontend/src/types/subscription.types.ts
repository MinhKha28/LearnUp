export type SubscriptionStatus = "Active" | "Grace" | "Suspended";

export interface IRenewalQuote {
  planName: string;
  planOffered: boolean;
  currentStatus: SubscriptionStatus;
  price: number;
  durationDays: number;
  maxLearners: number;
  maxInstructors: number;
  maxCourseChains: number;
  maxStorageBytes: number;
  startsAt: string;
  expiresAt: string;
  scheduledRenewal: { startsAt: string; expiresAt: string } | null;
  usageAvailable: boolean;
  exceededLimits: Array<{ limit: string; used: number; newLimit: number }>;
}

export interface IRenewalResult {
  paymentId: string;
  paymentStatus: "Succeeded" | "Failed";
  failureReason?: string | null;
  subscription?: {
    id: string;
    status: string;
    startsAt: string;
    expiresAt: string;
  };
}

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
