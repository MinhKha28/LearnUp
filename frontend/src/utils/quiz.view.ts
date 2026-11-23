import { formatMinutes } from "@/utils/helper";
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
    "Đã có học viên bắt đầu làm bài trắc nghiệm nên không thể sửa câu hỏi, thời gian làm bài, giới hạn lượt làm hoặc thời gian khóa tạm.",
  COURSE_LOCKED:
    "Khóa học đã khóa vì có học viên đăng ký nên không thể sửa điểm đạt hoặc yêu cầu bắt buộc.",
  COURSE_SUBMITTED: "Khóa học đang chờ phê duyệt. Hãy rút yêu cầu phê duyệt để chỉnh sửa.",
  COURSE_NOT_EDITABLE: "Khóa học đã lưu trữ hoặc bị vô hiệu hóa nên không thể chỉnh sửa bài trắc nghiệm.",
  COURSE_LEFT_DRAFT:
    "Khóa học đã qua giai đoạn bản nháp nên không thể xóa câu hỏi cuối cùng.",
};

/** Course-wide or Quiz-wide reasons shown as banners, in this order; COURSE_LEFT_DRAFT only concerns one question. */
const BANNER_REASONS: QuizLockReason[] = [
  "COURSE_SUBMITTED",
  "COURSE_NOT_EDITABLE",
  "COURSE_LOCKED",
  "QUIZ_HAS_ATTEMPTS",
];

export const QUIZ_BANNER_TITLE: Partial<Record<QuizLockReason, string>> = {
  COURSE_SUBMITTED: "Khóa học đang chờ phê duyệt",
  COURSE_NOT_EDITABLE: "Không thể chỉnh sửa khóa học",
  COURSE_LOCKED: "Khóa học đã khóa",
  QUIZ_HAS_ATTEMPTS: "Đã có lượt làm",
};

const QUESTION_TYPE_LABEL: Record<QuizQuestionType, string> = {
  SingleChoice: "Một đáp án đúng",
  MultipleChoice: "Nhiều đáp án đúng",
  TrueFalse: "Đúng / Sai",
};

export const quizQuestionTypeLabel = (type: string): string =>
  Object.hasOwn(QUESTION_TYPE_LABEL, type) ? QUESTION_TYPE_LABEL[type as QuizQuestionType] : "Không xác định";

/** BR-315: 0–100 scale with at most 2 decimals (72.5 → "72.5", 80 → "80"). */
export const formatQuizScore = (score: number): string =>
  score.toLocaleString("en-US", { maximumFractionDigits: 2, useGrouping: false });

/** A, B, C… for the options of a question. */
export const optionLetter = (index: number): string => String.fromCharCode(65 + index);

/** BR-154 / BR-291: where the Quiz sits in the Course outline. */
export const quizPlacementLabel = (
  quiz: Partial<Pick<IQuizDetail, "moduleId" | "placement">>,
  modules: Pick<ICourseStructureModule, "id" | "title">[],
): string => {
  if (quiz.moduleId === null || quiz.placement === "COURSE") return "Cuối khóa học";
  if (quiz.moduleId === undefined && quiz.placement === undefined) return "Chưa xác định vị trí";
  const index = modules.findIndex((module) => module.id === quiz.moduleId);
  if (index < 0) return "Không tìm thấy chương trong cấu trúc khóa học";
  return `Sau các bài học của chương ${index + 1}: ${modules[index].title}`;
};

export const quizAttemptLimitLabel = (
  maxConsecutiveAttempts?: number | null,
  lockoutHours?: number | null,
): string =>
  maxConsecutiveAttempts == null || lockoutHours == null
    ? "Chưa xác định"
    : `Tạm khóa trong ${formatMinutes(lockoutHours * 60)} sau ${maxConsecutiveAttempts} lượt làm liên tiếp.`;

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
