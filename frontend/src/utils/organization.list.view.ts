import type {
  IAdminOrganizationListItem,
} from "@/types/organization.types";
import { formatDateVN } from "@/utils/helper";

export { organizationStatusViewVi as organizationStatusView, subscriptionStatusViewVi as subscriptionStatusView } from "./organization.detail.view";

/** Ô Subscription khi tổ chức chưa có Subscription hiện hành. */
export const noSubscriptionLabel = (
  organization: IAdminOrganizationListItem,
): string =>
  organization.status === "PendingPayment" ? "Chờ thanh toán" : "—";

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
          ? `Hết thời gian ân hạn vào ${formatDateVN(subscription.graceEndsAt)}`
          : null,
    };
  }
  if (paymentDueAt) {
    return { primary: "—", secondary: `Hạn thanh toán: ${formatDateVN(paymentDueAt)}` };
  }
  return { primary: "—", secondary: null };
};
