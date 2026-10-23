import type { QuizLockReason, QuizSummary } from './quiz-list.interface';

/** BR-155: the three auto-graded question types, as written in quiz_questions.question_type. */
export const QUIZ_QUESTION_TYPES = [
  'SingleChoice',
  'MultipleChoice',
  'TrueFalse',
] as const;

export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export interface QuizOptionDetail {
  id: string;
  position: number;
  content: string;
  /** Answer key: only ever returned to the Instructor in charge (UC18.1). */
  isCorrect: boolean;
}

export interface QuizQuestionDetail {
  id: string;
  position: number;
  /** One of QUIZ_QUESTION_TYPES; the column has no CHECK, so another stored value is passed through as is. */
  type: string;
  content: string;
  options: QuizOptionDetail[];
}

/** Whether one change is possible now and, if not, why (BR-99). */
export interface QuizPermission {
  allowed: boolean;
  reasons: QuizLockReason[];
}

export interface QuizPermissions {
  /** UC18.3: add, edit or delete questions and answers (BR-96, BR-285). */
  editQuestions: QuizPermission;
  /** UC18.4: time limit (BR-97, BR-285). */
  editTimeLimit: QuizPermission;
  /** UC18.4: n consecutive attempts and m hours lockout (BR-97, BR-285). */
  editAttemptRule: QuizPermission;
  /** UC18.4: passing score (BR-94, BR-285). */
  editPassingScore: QuizPermission;
  /** UC18.4: required flag (BR-94, BR-157, BR-285). */
  editRequired: QuizPermission;
  /** UC18.5: delete the Quiz (BR-92, BR-285). */
  deleteQuiz: QuizPermission;
  /** UC18.3: delete the only remaining question (BR-96, BR-285, BR-323). */
  deleteLastQuestion: QuizPermission;
}

/** UC18.1 — one Quiz with its configuration, questions and answer keys, and what may be changed now. */
export interface QuizDetail extends QuizSummary {
  /** BR-154 / BR-291: after the Lessons of its Module, or at the end of the Course. */
  placement: 'MODULE' | 'COURSE';
  courseStatus: string;
  courseLocked: boolean;
  permissions: QuizPermissions;
  /** In display order (position); options too. */
  questions: QuizQuestionDetail[];
  createdAt: Date;
  updatedAt: Date;
}
