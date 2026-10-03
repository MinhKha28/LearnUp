import type { PageResponse } from '@learnup/ts-common';

/**
 * Giá trị cột assessments.kind của Quiz, dùng chung cho QuizService và prisma/seed-quizzes.ts.
 * Tài liệu ghi 'Quiz', code UC19 ghi 'ASSIGNMENT'; tạm dùng 'QUIZ' cho đồng bộ với dữ liệu hiện có, chờ nhóm chốt.
 */
export const QUIZ_KIND = 'QUIZ';

/**
 * Why a Quiz cannot be fully edited right now (BR-99), computed on read and never stored.
 * - QUIZ_HAS_ATTEMPTS: questions, time limit, n and m are frozen (BR-96, BR-97)
 * - COURSE_LOCKED: passing score and required flag are frozen (BR-94)
 * - COURSE_SUBMITTED: nothing can be edited while the Course is under review (BR-285)
 */
export type QuizLockReason =
  'QUIZ_HAS_ATTEMPTS' | 'COURSE_LOCKED' | 'COURSE_SUBMITTED';

export interface QuizSummary {
  id: string;
  courseId: string;
  /** null = attached to the Course itself (BR-154). */
  moduleId: string | null;
  title: string;
  position: number;
  questionCount: number;
  passingScore: number;
  isRequired: boolean;
  timeLimitMinutes: number | null;
  maxConsecutiveAttempts: number;
  lockoutHours: number;
  hasAttempts: boolean;
  locked: boolean;
  lockReasons: QuizLockReason[];
  disabled: boolean;
}

/** Same shape as UC19 ({ meta, items }) plus the Course-level flags the UI needs. */
export interface QuizListPage extends PageResponse<QuizSummary> {
  courseLocked: boolean;
  courseStatus: string;
}
