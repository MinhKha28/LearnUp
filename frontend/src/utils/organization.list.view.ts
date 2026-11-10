import type {
  AdminOrganizationStatus,
  AdminSubscriptionStatus,
  IAdminOrganizationListItem,
} from "@/types/organization.types";
import { formatDateVN } from "@/utils/helper";

type Tone = "neutral" | "success" | "warning" | "error" | "info";

// UC44 - trạng thái Organization (BR-8, BR-56), hiển thị riêng với Subscription (BR-60)
export const organizationStatusView: Record<
  AdminOrganizationStatus,
  { label: string; tone: Tone }
> = {
  PendingPayment: { label: "Pending payment", tone: "warning" },
  Active: { label: "Active", tone: "success" },
  Suspended: { label: "Suspended", tone: "error" },
  Cancelled: { label: "Cancelled", tone: "neutral" },
};

// UC44 - BR-22, BR-23: phân biệt đang hoạt động, ân hạn, Suspended
export const subscriptionStatusView: Record<
  AdminSubscriptionStatus,
  { label: string; tone: Tone }
> = {
  Active: { label: "Active", tone: "info" },
  Grace: { label: "Grace period", tone: "warning" },
  Suspended: { label: "Suspended", tone: "error" },
};

/** Ô Subscription khi tổ chức chưa có Subscription hiện hành. */
export const noSubscriptionLabel = (
  organization: IAdminOrganizationListItem,
): string =>
  organization.status === "PendingPayment" ? "Awaiting payment" : "None";

/** Thời hạn hiển thị: kỳ Subscription, kèm hạn ân hạn khi Grace; hoặc hạn thanh toán khi chờ thanh toán. */
export const subscriptionTermLabel = (
  organization: IAdminOrganizationListItem,
): { primary: string; secondary: string | null } => {
  const { subscription, paymentDueAt } = organization;
  if (subscription) {
    return {
      primary: `${formatDateVN(subscription.startsAt)} – ${formatDateVN(subscription.expiresAt)}`,
      secondary:
        subscription.status === "Grace" && subscription.graceEndsAt
          ? `Grace until ${formatDateVN(subscription.graceEndsAt)}`
          : null,
    };
  }
  if (paymentDueAt) {
    return { primary: "—", secondary: `Pay by ${formatDateVN(paymentDueAt)}` };
  }
  return { primary: "—", secondary: null };
};
