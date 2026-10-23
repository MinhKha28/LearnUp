export type WatchedRange = [number, number];

/** BR-181: chỉ ghi giây media đã phát đủ; PostgreSQL hợp các khoảng nguyên. */
export function normalizeRanges(
  ranges: WatchedRange[],
  duration: number,
): WatchedRange[] {
  return ranges
    .map(([start, end]): WatchedRange => [
      Math.min(duration, Math.ceil(start)),
      Math.min(duration, Math.floor(end)),
    ])
    .filter(([start, end]) => start < end);
}

/** BR-182: không cho đồng hồ client vượt server quá 60 giây. */
export function positionReportedAt(reportedAt: string, now: Date): Date {
  const candidate = new Date(reportedAt);
  return candidate.getTime() > now.getTime() + 60_000 ? now : candidate;
}

export function requiredSeconds(duration: number, percent: number): number {
  return Math.ceil((duration * percent) / 100);
}
