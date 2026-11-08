import { DEFAULT_ORG_TIMEZONE } from '../learner-submissions/peer-review-calendar';

/**
 * The notices of UC33 that this service still sends itself by REST (the waiver and the reminder); the notice of the hand-out
 * is an event that notification-service words. The Learner reads them, so the text is Vietnamese.
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

/** The Instructor waived the peer review duty of the Learner (UC33.2). The Learner reads it, so it is Vietnamese. */
export const waivedNotice = (assignmentTitle: string): ReviewNotice => ({
  title: 'Bạn được miễn nghĩa vụ chấm chéo',
  message: `Giảng viên đã miễn nghĩa vụ chấm chéo của bạn cho "${assignmentTitle}". Bạn không cần chấm thêm bài nào cho bài tập này.`,
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
