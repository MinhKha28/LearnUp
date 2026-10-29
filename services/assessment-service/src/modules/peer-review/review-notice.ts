import { DEFAULT_ORG_TIMEZONE } from '../learner-submissions/peer-review-calendar';

/**
 * The two notices a reviewer reads in the bell of the app (UC33, UC49). The Learner reads them, so the text is Vietnamese.
 * The time is the one on the wall of the Organization, not UTC.
 */
export interface ReviewNotice {
  title: string;
  message: string;
}

/** dd/MM/yyyy HH:mm in the time zone of the Organization. */
export function formatDeadline(
  at: Date,
  timeZone: string = DEFAULT_ORG_TIMEZONE,
): string {
  const part = new Map(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value] as const),
  );
  return `${part.get('day')}/${part.get('month')}/${part.get('year')} ${part.get('hour')}:${part.get('minute')}`;
}

/** The cycle closed and the reviews were handed out. */
export const assignedNotice = (
  total: number,
  assignmentTitle: string,
  reviewDueAt: Date,
): ReviewNotice => ({
  title: 'Bạn có bài cần chấm chéo',
  message: `Bạn có ${total} bài nộp cần chấm cho "${assignmentTitle}". Vui lòng hoàn thành trước ${formatDeadline(reviewDueAt)}.`,
});

/** The review deadline is close and some reviews are still not done. */
export const reminderNotice = (
  total: number,
  assignmentTitle: string,
  reviewDueAt: Date,
): ReviewNotice => ({
  title: 'Sắp đến hạn chấm chéo',
  message: `Bạn còn ${total} bài nộp chưa chấm cho "${assignmentTitle}". Hạn chấm là ${formatDeadline(reviewDueAt)}.`,
});
