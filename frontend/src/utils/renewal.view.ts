import type { IRenewalQuote } from "@/types/subscription.types";
import { formatStorage } from "@/utils/helper";

const LIMIT_LABELS: Record<string, string> = {
  learners: "Learners",
  instructors: "Instructors",
  courses: "Courses",
  storageBytes: "Storage",
};

export const exceededLimitLines = (
  exceeded: IRenewalQuote["exceededLimits"],
): string[] =>
  exceeded.map(({ limit, used, newLimit }) => {
    const label = LIMIT_LABELS[limit] ?? limit;
    return limit === "storageBytes"
      ? `${label}: using ${formatStorage(used)}, new limit ${formatStorage(newLimit)}`
      : `${label}: using ${used}, new limit ${newLimit}`;
  });

export const renewalTermNote = (status: IRenewalQuote["currentStatus"]) => {
  switch (status) {
    case "Grace":
      return "You are in the grace period: the new term counts from the old expiry date, so the grace days already used are part of it.";
    case "Suspended":
      return "Your Subscription is suspended: the new term starts on the payment date and full access returns right away.";
    default:
      return "Your current term keeps running: the new term starts when it expires.";
  }
};

export const renewalErrorMessage = (code: string | undefined) => {
  switch (code) {
    case "RENEWAL_ALREADY_SCHEDULED":
      return "A renewal is already paid and waiting to start. You can renew again after it starts.";
    case "RENEWAL_IN_PROGRESS":
      return "Another renewal is being processed. Please wait a moment and try again.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Your Organization is not active, so the Subscription cannot be renewed.";
    case "SUBSCRIPTION_NOT_FOUND":
      return "Your Organization has no Subscription to renew.";
    default:
      return "Could not process the renewal. Please try again later.";
  }
};
