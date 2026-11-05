// UC28.1: how the results of a Learner are put into words. Apart from the page so that it can be tested without a browser.
import type {
  AssessmentResultItem,
  AssessmentResultsSummary,
} from "@/types/learning.types";
import { LEARNER_ROUTES } from "@/utils/learner.routes";

export type ResultTone = "success" | "warning" | "error" | "info" | "neutral";

/** The score as the Learner reads it: 66.67 → "66,67", 50 → "50". */
export const formatResultScore = (score: number): string =>
  score.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export const kindLabel = (item: AssessmentResultItem): string =>
  item.kind === "QUIZ" ? "Bài kiểm tra" : "Bài tập";

export const requirementLabel = (item: AssessmentResultItem): string =>
  item.isRequired ? "Bắt buộc" : "Không bắt buộc";

/** BR-191: no score yet is "not completed", never "failed". */
export const resultStatusView = (
  item: AssessmentResultItem,
): { label: string; tone: ResultTone } => {
  if (item.passed === true) return { label: "Đạt", tone: "success" };
  if (item.passed === false) return { label: "Chưa đạt", tone: "error" };
  if (item.status === "AwaitingResult")
    return { label: "Chờ chấm", tone: "warning" };
  return { label: "Đang làm", tone: "info" };
};

/** The comparison with the passing score, in words: how far above, how far below, or why there is nothing to compare. */
export const gapText = (item: AssessmentResultItem): string => {
  if (item.recordedScore === null || item.passed === null) {
    return item.status === "AwaitingResult"
      ? "Đang chờ chấm điểm"
      : "Chưa có điểm để so sánh";
  }
  const gap = Math.round((item.recordedScore - item.passingScore) * 100) / 100;
  if (gap === 0) return "Vừa đủ điểm đạt";
  return gap > 0
    ? `Cao hơn điểm đạt ${formatResultScore(gap)} điểm`
    : `Còn thiếu ${formatResultScore(-gap)} điểm để đạt`;
};

/** Width of the bar of the score, and where the passing score falls on it: both between 0 and 100. */
export const scoreBar = (
  item: AssessmentResultItem,
): { score: number; passing: number } => ({
  score: Math.min(100, Math.max(0, item.recordedScore ?? 0)),
  passing: Math.min(100, Math.max(0, item.passingScore)),
});

/** One line for the attempts of a Quiz: "Lượt 1: 50 · Lượt 2: 85 (hết giờ)". */
export const attemptsLine = (item: AssessmentResultItem): string => {
  if (!item.quiz || item.quiz.attempts.length === 0) return "";
  return item.quiz.attempts
    .map(
      (a) =>
        `Lượt ${a.attemptNumber}: ${formatResultScore(a.score)}${a.submissionKind === "TimedOut" ? " (hết giờ)" : ""}`,
    )
    .join(" · ");
};

export const summaryLine = (summary: AssessmentResultsSummary): string => {
  if (summary.total === 0)
    return "Bạn chưa làm bài kiểm tra hoặc bài tập nào trong khóa học này.";
  const parts = [`Đã làm ${summary.total} bài`];
  parts.push(`đạt ${summary.passed}`);
  if (summary.notPassed > 0) parts.push(`chưa đạt ${summary.notPassed}`);
  if (summary.pending > 0) parts.push(`chờ kết quả ${summary.pending}`);
  return `${parts.join(", ")}.`;
};

export const formatResultTime = (iso: string): string =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Where a row leads to read more or to continue. */
export const resultTarget = (
  enrollmentId: string,
  item: AssessmentResultItem,
): { label: string; to: string } => {
  if (item.kind === "QUIZ") {
    return item.status === "InProgress"
      ? {
          label: "Tiếp tục làm bài",
          to: LEARNER_ROUTES.quiz(enrollmentId, item.assessmentId),
        }
      : {
          label: "Lịch sử làm bài",
          to: LEARNER_ROUTES.quizHistory(enrollmentId, item.assessmentId),
        };
  }
  return item.status === "Completed"
    ? {
        label: "Xem kết quả chấm",
        to: LEARNER_ROUTES.assignmentResult(enrollmentId, item.assessmentId),
      }
    : { label: "Xem bài tập", to: LEARNER_ROUTES.assessments(enrollmentId) };
};
