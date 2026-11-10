/**
 * Trạng thái truy cập của một tổ chức cho service khác (learning, achievement-reporting).
 * subscriptionStatus: Subscription hiện hành (Active, Grace, Suspended), không có thì Ended.
 * readOnlyEndsAt: chỉ có khi Suspended, hạn Organizer còn chỉ xem (BR-24); trạng thái khác là null.
 */
export interface IOrganizationAccess {
  organizationId: string;
  organizationStatus: string;
  subscriptionStatus: string;
  readOnlyEndsAt: Date | null;
  timezone: string;
}
