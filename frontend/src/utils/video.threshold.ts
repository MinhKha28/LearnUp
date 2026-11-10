export const videoThresholdPercent = (durationSeconds: number, requiredSeconds: number): number =>
  durationSeconds > 0 && Number.isFinite(durationSeconds) && Number.isFinite(requiredSeconds)
    ? Math.round((requiredSeconds / durationSeconds) * 100)
    : 0;
