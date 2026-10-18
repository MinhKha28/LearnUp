export type WatchedRange = [number, number];

/** D86: chỉ ghi giây media đã phát đủ; PostgreSQL gộp các khoảng nguyên. */
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

export function progressBudget(now: Date, lastReportedAt: Date | null): number {
  const elapsed =
    lastReportedAt === null
      ? 20
      : Math.max(0, (now.getTime() - lastReportedAt.getTime()) / 1000);
  return Math.ceil(Math.min(elapsed, 60) * 2) + 5;
}

export function requiredSeconds(duration: number, percent: number): number {
  return Math.ceil((duration * percent) / 100);
}
