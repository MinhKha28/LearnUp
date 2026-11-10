/** Trạng thái ghi lại sau một lần gửi lỗi: hẹn lần thử kế tiếp, hoặc dừng hẳn khi failedAt có giá trị. */
export interface IOutboxRetryState {
  attempts: number;
  lastErrorCode: string;
  nextAttemptAt: Date | null;
  failedAt: Date | null;
}
