export const ENROLLMENT_RATE_LIMIT_TTL = 60_000;

export function readEnrollmentRateLimit(raw: string | undefined): number {
  if (raw === undefined) return 10;
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1000) {
    throw new Error(
      'ENROLLMENT_RATE_LIMIT_PER_MINUTE phải là số nguyên từ 1 đến 1000.',
    );
  }
  return Number(raw);
}
