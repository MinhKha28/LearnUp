// UC29.1: the small rules of the Quiz screen, apart from the page so that they can be tested without a browser.

import { learnerPlatformErrorText } from "./learner.api.errors";

const MULTIPLE = "MultipleChoice";

export const questionTypeLabel = (type: string) => {
  if (type === MULTIPLE) return "Nhiều đáp án";
  if (type === "TrueFalse") return "Đúng / Sai";
  return "Một đáp án";
};

/** The options chosen after the Learner clicks one: a multiple-choice question toggles it, any other replaces the choice. */
export const selectionAfterClick = (
  type: string,
  current: string[],
  optionId: string,
): string[] => {
  if (type !== MULTIPLE)
    return current.length === 1 && current[0] === optionId
      ? current
      : [optionId];
  return current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : [...current, optionId];
};

/**
 * Seconds left. The deadline is the server's; the device clock is not trusted. The page keeps how far its own clock was
 * from the server's when the answer arrived (`offsetMs` = server now - device now) and counts from that (BR-200).
 */
export const secondsLeft = (
  deadlineAt: string,
  deviceNowMs: number,
  offsetMs: number,
): number =>
  Math.max(
    0,
    Math.ceil(
      (new Date(deadlineAt).getTime() - (deviceNowMs + offsetMs)) / 1000,
    ),
  );

export const clockOffsetMs = (serverNow: string, deviceNowMs: number): number =>
  new Date(serverNow).getTime() - deviceNowMs;

/** 9:05 or 1:02:03 */
export const formatCountdown = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
};

const QUIZ_ERRORS: Record<string, string> = {
  ASSESSMENT_LOCKED:
    "Bạn đã làm đủ số lượt liên tiếp nên bài trắc nghiệm đang tạm khóa.",
  ASSESSMENT_DISABLED: "Bài trắc nghiệm này đã bị vô hiệu hóa.",
  ENROLLMENT_COMPLETED:
    "Bạn đã hoàn thành khóa học nên không thể bắt đầu lượt làm bài mới.",
  ENROLLMENT_NOT_ACTIVE:
    "Khóa học đã tạm dừng hoặc bạn đã rút khỏi khóa học nên không thể làm bài trắc nghiệm. Hãy liên hệ quản lý đào tạo nếu cần hỗ trợ.",
  NOT_ENROLLED: "Bạn chưa ghi danh vào khóa học có bài trắc nghiệm này.",
  QUIZ_NOT_FOUND: "Không tìm thấy bài trắc nghiệm.",
  ATTEMPT_NOT_CLOSED: "Không nộp được bài. Vui lòng thử lại.",
  LEARNING_SERVICE_UNAVAILABLE: "Dịch vụ học tập tạm thời gián đoạn. Vui lòng thử lại.",
  ATTEMPT_NOT_FOUND: "Không tìm thấy lượt làm bài.",
  QUIZ_HAS_NO_QUESTIONS:
    "Bài trắc nghiệm này chưa có câu hỏi nào nên chưa thể làm.",
  QUIZ_HAS_NO_TIME_LIMIT:
    "Bài trắc nghiệm này chưa được đặt thời gian làm bài nên chưa thể làm.",
  ATTEMPT_EXPIRED:
    "Đã hết thời gian. Bài được nộp tự động với các câu bạn đã trả lời.",
  ATTEMPT_SUBMITTED: "Lượt làm bài này đã được nộp.",
  OPTION_NOT_IN_QUESTION: "Đáp án không thuộc câu hỏi này.",
  TOO_MANY_OPTIONS: "Câu hỏi này chỉ chọn được một đáp án.",
  QUESTION_NOT_FOUND: "Câu hỏi không thuộc bài trắc nghiệm này.",
};

/** Codes after which what the page shows is out of date: it loads the attempt again and shows what the server decided. */
export const QUIZ_STALE_CODES = ["ATTEMPT_EXPIRED", "ATTEMPT_SUBMITTED"];

/** The text of a failed answer, in Vietnamese: the server messages are English. */
export const quizErrorText = (
  code: string | undefined,
  fallback: string,
): string => {
  if (code && Object.hasOwn(QUIZ_ERRORS, code)) return QUIZ_ERRORS[code];
  return learnerPlatformErrorText(code) ?? fallback;
};
