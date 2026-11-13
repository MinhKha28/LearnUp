import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_DELAYS_MS = [1000, 4000, 15000, 45000];

/**
 * How long to wait between the attempts of a notice: one more attempt after each delay, so four delays are five attempts
 * and about a minute in all: a notification-service that restarts needs ten seconds or more to answer again.
 * `NOTICE_RETRY_DELAYS_MS` ("1000,4000,15000,45000") lets a test make them short.
 */
export function noticeRetryDelaysMs(
  raw: string | undefined = process.env.NOTICE_RETRY_DELAYS_MS,
): number[] {
  const parsed = raw
    ?.split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '') // an empty item is not a delay of zero
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0);
  return parsed && parsed.length > 0 ? parsed : DEFAULT_DELAYS_MS;
}

/**
 * Runs `work`, and runs it again after each delay while it keeps failing; the last failure is thrown. It is for the notices,
 * which are a side effect of something that already happened: a notification-service that restarts or answers 503 for a
 * few seconds must not cost the Learner the notice. It does not outlive the process, and a request that timed out after
 * the server had done the work is repeated (the notice may then appear twice, never zero times).
 */
export async function withRetries<T>(
  work: () => Promise<T>,
  delaysMs: readonly number[],
  onRetry?: (error: unknown, nextAttempt: number) => void,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= delaysMs.length) throw error;
      onRetry?.(error, attempt + 2);
      await sleep(delaysMs[attempt]);
    }
  }
}
