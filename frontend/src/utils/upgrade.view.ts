import type { IUpgradeOption } from "@/types/subscription.types";
import { formatStorage, formatVnd } from "@/utils/helper";

export const formatCount = (value: number) => value.toLocaleString("en-US");

const LIMIT_LABELS: Record<string, string> = {
  learners: "Learners",
  instructors: "Instructors",
  courses: "Courses",
  storageBytes: "Storage",
};

export const planLimitsLine = (
  plan: Pick<
    IUpgradeOption,
    "maxLearners" | "maxInstructors" | "maxCourseChains" | "maxStorageBytes"
  >,
) =>
  `${formatCount(plan.maxLearners)} Learners · ${formatCount(plan.maxInstructors)} Instructors · ${formatCount(plan.maxCourseChains)} Courses · ${formatStorage(plan.maxStorageBytes)}`;

export const planPriceLine = (plan: IUpgradeOption) =>
  `${formatVnd(plan.price)} / ${formatCount(plan.durationDays)} days`;

export const upgradeFormulaLine = (
  plan: IUpgradeOption,
  held: { price: number; durationDays: number },
  remainingDays: number,
) => {
  const daily = (price: number, days: number) =>
    formatVnd(Math.round(price / days));
  return `(${daily(plan.price, plan.durationDays)} − ${daily(held.price, held.durationDays)}) per day × ${formatCount(remainingDays)} remaining days = ${formatVnd(plan.amount)}`;
};

export const blockedLimitLines = (blockedBy: IUpgradeOption["blockedBy"]) =>
  blockedBy.map(({ limit, newLimit, required }) => {
    const label = LIMIT_LABELS[limit] ?? limit;
    return limit === "storageBytes"
      ? `${label}: ${formatStorage(newLimit)} is below the ${formatStorage(required)} you need`
      : `${label}: ${formatCount(newLimit)} is below the ${formatCount(required)} you need`;
  });

export const upgradeBlockedMessage = (reason: string | null) => {
  switch (reason) {
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Upgrades are only available while the Subscription is active. Please renew first.";
    case "RENEWAL_ALREADY_SCHEDULED":
      return "A renewal is already paid and waiting to start. You can upgrade after it starts.";
    default:
      return null;
  }
};

export const upgradeErrorMessage = (code: string | undefined) => {
  switch (code) {
    case "UPGRADE_LIMITS_TOO_LOW":
      return "This plan's limits are below your current usage or limits.";
    case "PLAN_NOT_AVAILABLE":
      return "This plan is no longer available. Please choose another.";
    case "USAGE_UNAVAILABLE":
      return "Course and storage usage could not be checked. Please try again later.";
    case "RENEWAL_IN_PROGRESS":
      return "Another Subscription change is being processed. Please try again.";
    case "SUBSCRIPTION_NOT_ACTIVE":
    case "RENEWAL_ALREADY_SCHEDULED":
      return upgradeBlockedMessage(code) as string;
    case "ORGANIZATION_NOT_ACTIVE":
      return "Your Organization is not active, so the Subscription cannot be upgraded.";
    default:
      return "Could not process the upgrade. Please try again later.";
  }
};
