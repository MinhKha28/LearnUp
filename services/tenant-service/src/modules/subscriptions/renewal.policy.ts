import {
  DAY_MS,
  SubscriptionStatus,
} from '../../common/constants/tenant.constants';

export interface IRenewalPeriod {
  status:
    typeof SubscriptionStatus.Active | typeof SubscriptionStatus.Scheduled;
  startsAt: Date;
  expiresAt: Date;
  endsCurrent: boolean;
}

/**
 * Active: gia hạn sớm, kỳ Scheduled bắt đầu từ ngày hết hạn hiện tại (BR-17).
 * Grace: kỳ mới tính từ ngày hết hạn cũ, ngày ân hạn đã dùng bị trừ vào kỳ mới (BR-15).
 * Suspended: kỳ mới tính từ ngày thanh toán (BR-16).
 * Trả null khi trạng thái không gia hạn được.
 */
export function renewalPeriod(
  current: { status: string; expiresAt: Date },
  durationDays: number,
  paidAt: Date,
): IRenewalPeriod | null {
  const after = (startsAt: Date) =>
    new Date(startsAt.getTime() + durationDays * DAY_MS);
  switch (current.status) {
    case SubscriptionStatus.Active:
      return {
        status: SubscriptionStatus.Scheduled,
        startsAt: current.expiresAt,
        expiresAt: after(current.expiresAt),
        endsCurrent: false,
      };
    case SubscriptionStatus.Grace:
      return {
        status: SubscriptionStatus.Active,
        startsAt: current.expiresAt,
        expiresAt: after(current.expiresAt),
        endsCurrent: true,
      };
    case SubscriptionStatus.Suspended:
      return {
        status: SubscriptionStatus.Active,
        startsAt: paidAt,
        expiresAt: after(paidAt),
        endsCurrent: true,
      };
    default:
      return null;
  }
}

/** BR-4: giới hạn của kỳ mới thấp hơn mức đang dùng thì vẫn gia hạn, chỉ cảnh báo. used = null là chưa lấy được số liệu. */
export function exceededLimits(
  usage: Record<string, number | null>,
  limits: Record<string, number>,
): Array<{ limit: string; used: number; newLimit: number }> {
  return Object.entries(limits).flatMap(([limit, newLimit]) => {
    const used = usage[limit];
    return used !== null && used !== undefined && used > newLimit
      ? [{ limit, used, newLimit }]
      : [];
  });
}
