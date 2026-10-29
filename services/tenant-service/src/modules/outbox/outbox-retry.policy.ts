import { IOutboxRetryState } from './interfaces/outbox-retry-state.interface';

export const OUTBOX_MAX_ATTEMPTS = 8;
export const OUTBOX_BACKOFF_BASE_MS = 5000;
export const OUTBOX_BACKOFF_MAX_MS = 10 * 60 * 1000;

/**
 * Lần lỗi thứ n hẹn thử lại sau 5 s × 2^(n-1), tối đa 10 phút; lỗi lần thứ 8 thì dừng hẳn (failedAt).
 * Tổng thời gian chờ trước khi dừng khoảng 10,6 phút, xấp xỉ hạn 10 phút của mã xác thực (BR-13).
 */
export function nextRetryState(
  previousAttempts: number,
  lastErrorCode: string,
  now: Date,
): IOutboxRetryState {
  const attempts = previousAttempts + 1;
  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    return { attempts, lastErrorCode, nextAttemptAt: null, failedAt: now };
  }
  const delayMs = Math.min(
    OUTBOX_BACKOFF_BASE_MS * 2 ** (attempts - 1),
    OUTBOX_BACKOFF_MAX_MS,
  );
  return {
    attempts,
    lastErrorCode,
    nextAttemptAt: new Date(now.getTime() + delayMs),
    failedAt: null,
  };
}
