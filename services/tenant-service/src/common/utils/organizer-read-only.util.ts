import { DAY_MS } from '../constants/tenant.constants';

export const ORGANIZER_READ_ONLY_DAYS = 30;

/**
 * BR-24: Subscription Suspended thì Organizer còn chỉ xem và kết xuất báo cáo trong 30 ngày kể từ khi Suspended.
 * Ưu tiên giá trị đã chốt trên Subscription; chưa có thì tính từ suspended_at. Dùng chung cho sign-in-access
 * và /internal/organizations/:id/access để hai nơi luôn cho cùng một mốc.
 */
export function organizerReadOnlyEndsAt(subscription: {
  readOnlyEndsAt: Date | null;
  suspendedAt: Date | null;
}): Date | null {
  if (subscription.readOnlyEndsAt) return subscription.readOnlyEndsAt;
  return subscription.suspendedAt
    ? new Date(
        subscription.suspendedAt.getTime() + ORGANIZER_READ_ONLY_DAYS * DAY_MS,
      )
    : null;
}
