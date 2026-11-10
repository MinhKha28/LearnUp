import type { ICourseStructureModule } from "@/types/course.types";
import type {
  IQuizDetail,
  IQuizPermission,
  IQuizPermissions,
  QuizLockReason,
  QuizQuestionType,
} from "@/types/assessment.types";

// BR-99: say why a Quiz cannot be edited instead of only showing a state.
export const QUIZ_LOCK_REASON_TEXT: Record<QuizLockReason, string> = {
  QUIZ_HAS_ATTEMPTS:
    "A Learner has started this Quiz, so its questions, time limit, attempt limit and lockout period can no longer be changed.",
  COURSE_LOCKED:
    "The Course is Locked because a Learner has enrolled, so the passing score and Required setting can no longer be changed.",
  COURSE_SUBMITTED: "The Course is Submitted for review, so nothing can be changed until it is withdrawn.",
  COURSE_NOT_EDITABLE: "The Course is archived or disabled, so this Quiz can no longer be changed.",
  COURSE_LEFT_DRAFT:
    "The Course has left Draft, so the last remaining question of this Quiz cannot be deleted.",
};

/** Course-wide or Quiz-wide reasons shown as banners, in this order; COURSE_LEFT_DRAFT only concerns one question. */
const BANNER_REASONS: QuizLockReason[] = [
  "COURSE_SUBMITTED",
  "COURSE_NOT_EDITABLE",
  "COURSE_LOCKED",
  "QUIZ_HAS_ATTEMPTS",
];

export const QUIZ_BANNER_TITLE: Partial<Record<QuizLockReason, string>> = {
  COURSE_SUBMITTED: "Course Submitted",
  COURSE_NOT_EDITABLE: "Course not editable",
  COURSE_LOCKED: "Course Locked",
  QUIZ_HAS_ATTEMPTS: "Quiz already attempted",
};

const QUESTION_TYPE_LABEL: Record<QuizQuestionType, string> = {
  SingleChoice: "Single answer",
  MultipleChoice: "Multiple answers",
  TrueFalse: "True / False",
};

/** BR-155 label; an unexpected stored value is shown as it is rather than hidden. */
export const quizQuestionTypeLabel = (type: string): string =>
  QUESTION_TYPE_LABEL[type as QuizQuestionType] ?? type;

/** BR-315: 0–100 scale with at most 2 decimals (72.5 → "72.5", 80 → "80"). */
export const formatQuizScore = (score: number): string =>
  score.toLocaleString("en-US", { maximumFractionDigits: 2, useGrouping: false });

/** A, B, C… for the options of a question. */
export const optionLetter = (index: number): string => String.fromCharCode(65 + index);

/** BR-154 / BR-291: where the Quiz sits in the Course outline. */
export const quizPlacementLabel = (
  quiz: Pick<IQuizDetail, "moduleId">,
  modules: Pick<ICourseStructureModule, "id" | "title">[],
): string => {
  if (quiz.moduleId === null) return "Attached to the Course · shown at the end of the Course";
  const index = modules.findIndex((module) => module.id === quiz.moduleId);
  if (index < 0) return "Attached to a Module that is not in the current outline";
  return `Module ${index + 1}: ${modules[index].title} · shown after its Lessons`;
};

/** The reasons of a blocked permission as sentences; empty when the change is allowed. */
export const permissionReasonTexts = (permission: IQuizPermission): string[] =>
  permission.allowed ? [] : permission.reasons.map((reason) => QUIZ_LOCK_REASON_TEXT[reason]);

/** One action covering several changes (e.g. UC18.4) is open when any of them is; blocked, it gives every reason once. */
export const combinePermissions = (permissions: IQuizPermission[]): IQuizPermission => {
  if (permissions.some((permission) => permission.allowed)) return { allowed: true, reasons: [] };
  return {
    allowed: false,
    reasons: [...new Set(permissions.flatMap((permission) => permission.reasons))],
  };
};

/** The reasons to show as page banners: every blocking reason of the Quiz, once, Course-wide ones first. */
export const quizBannerReasons = (permissions: IQuizPermissions): QuizLockReason[] => {
  const present = new Set(Object.values(permissions).flatMap((permission) => permission.reasons));
  return BANNER_REASONS.filter((reason) => present.has(reason));
};

/** A question without a correct option cannot be graded; the Instructor should see it. */
export const hasCorrectOption = (question: IQuizDetail["questions"][number]): boolean =>
  question.options.some((option) => option.isCorrect);
