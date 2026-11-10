import type { CourseAuthoringContext } from '../../infrastructure/clients/course/course-service.client';
import { AUTHORABLE_STATUSES } from '../assessments/assessments.service';
import type {
  QuizPermission,
  QuizPermissions,
} from './interfaces/quiz-detail.interface';
import type { QuizLockReason } from './interfaces/quiz-list.interface';

/** BR-323: the last question can only be deleted while the Course is still Draft or Rejected. */
const LAST_QUESTION_DELETABLE_STATUSES = ['Draft', 'Rejected'];

export interface QuizAccess {
  /** The UC18 list reasons: attempts (BR-96, BR-97), Locked (BR-94), Submitted (BR-285), in that order. */
  lockReasons: QuizLockReason[];
  permissions: QuizPermissions;
}

const permission = (reasons: QuizLockReason[]): QuizPermission => ({
  allowed: reasons.length === 0,
  reasons,
});

/**
 * What can be changed on a Quiz right now and why not (BR-99). Pure: computed on read from the Course facts
 * Course Service just returned (BR-78) and whether a Learner has started the Quiz; never stored.
 */
export function computeQuizPermissions(
  course: Pick<CourseAuthoringContext, 'status' | 'locked' | 'disabled'>,
  hasAttempts: boolean,
): QuizAccess {
  const submitted = course.status === 'Submitted';
  const notEditable =
    course.disabled || !AUTHORABLE_STATUSES.includes(course.status);
  // BR-285: a Course in review, archived or disabled accepts no change at all.
  const courseBlock: QuizLockReason[] = submitted
    ? ['COURSE_SUBMITTED']
    : notEditable
      ? ['COURSE_NOT_EDITABLE']
      : [];
  const attempts: QuizLockReason[] = hasAttempts ? ['QUIZ_HAS_ATTEMPTS'] : [];
  const locked: QuizLockReason[] = course.locked ? ['COURSE_LOCKED'] : [];
  const leftDraft: QuizLockReason[] =
    courseBlock.length === 0 &&
    !LAST_QUESTION_DELETABLE_STATUSES.includes(course.status)
      ? ['COURSE_LEFT_DRAFT']
      : [];

  return {
    lockReasons: [
      ...attempts,
      ...locked,
      ...(submitted ? (['COURSE_SUBMITTED'] as const) : []),
    ],
    permissions: {
      editQuestions: permission([...courseBlock, ...attempts]), // BR-96
      editTimeLimit: permission([...courseBlock, ...attempts]), // BR-97
      editAttemptRule: permission([...courseBlock, ...attempts]), // BR-97
      editPassingScore: permission([...courseBlock, ...locked]), // BR-94
      editRequired: permission([...courseBlock, ...locked]), // BR-94
      // BR-92: only the pair Locked + attempts blocks the delete (same check as deleteQuiz).
      deleteQuiz: permission([
        ...courseBlock,
        ...(course.locked && hasAttempts
          ? (['COURSE_LOCKED', 'QUIZ_HAS_ATTEMPTS'] as const)
          : []),
      ]),
      deleteLastQuestion: permission([
        ...courseBlock,
        ...attempts,
        ...leftDraft,
      ]), // BR-96, BR-323
    },
  };
}
