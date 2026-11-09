/** UC44: gói gắn với Organization (gói của Subscription hiện hành, hoặc gói đã đăng ký khi chưa có). */
export interface IAdminOrganizationPlan {
  id: string;
  name: string;
}

/** UC44: Subscription hiện hành (Active, Grace, Suspended), độc lập với trạng thái Organization (BR-60). */
export interface IAdminOrganizationSubscription {
  status: string; // Active | Grace | Suspended
  startsAt: Date;
  expiresAt: Date;
  graceEndsAt: Date | null;
}

/** UC44: một dòng trong danh sách Organization của Admin. */
export interface IAdminOrganizationListItem {
  id: string;
  name: string;
  contactEmail: string | null;
  // Trạng thái hiệu lực: PendingPayment đã quá hạn thanh toán được tính là Cancelled lúc đọc (BR-8).
  status: string; // PendingPayment | Active | Suspended | Cancelled
  plan: IAdminOrganizationPlan | null;
  subscription: IAdminOrganizationSubscription | null;
  // Hạn thanh toán của đăng ký, chỉ có khi status = PendingPayment.
  paymentDueAt: Date | null;
  createdAt: Date;
}
