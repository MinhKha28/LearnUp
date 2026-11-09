import { DAY_MS } from '../../common/constants/tenant.constants';

/** BR-19: phần ngày lẻ tính tròn thành một ngày. */
export function remainingDays(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS));
}

/**
 * BR-19: (đơn giá ngày gói mới − đơn giá ngày đang giữ) × số ngày còn lại, làm tròn lên đến đồng;
 * kết quả không lớn hơn 0 thì không cần thanh toán. Tính bằng BigInt trên một mẫu số chung để không sai số.
 */
export function upgradeAmount(
  target: { price: bigint; durationDays: number },
  held: { price: bigint; durationDays: number },
  days: number,
): bigint {
  const targetDays = BigInt(target.durationDays);
  const heldDays = BigInt(held.durationDays);
  const numerator =
    (target.price * heldDays - held.price * targetDays) * BigInt(days);
  if (numerator <= 0n) return 0n;
  const denominator = targetDays * heldDays;
  return (numerator + denominator - 1n) / denominator;
}

export interface ILimitValues {
  learners: number;
  instructors: number;
  courses: number;
  storageBytes: number;
}

/**
 * BR-18, BR-21: mỗi giới hạn của gói đích phải không nhỏ hơn mức đang dùng và không nhỏ hơn giới hạn đang giữ
 * (nhỏ hơn giới hạn đang giữ là hạ cấp). Trả về các giới hạn không đạt.
 */
export function blockingLimits(
  target: ILimitValues,
  held: ILimitValues,
  usage: Record<keyof ILimitValues, number | null>,
): Array<{ limit: string; newLimit: number; required: number }> {
  return (Object.keys(target) as Array<keyof ILimitValues>).flatMap((limit) => {
    const required = Math.max(held[limit], usage[limit] ?? 0);
    return target[limit] < required
      ? [{ limit, newLimit: target[limit], required }]
      : [];
  });
}
