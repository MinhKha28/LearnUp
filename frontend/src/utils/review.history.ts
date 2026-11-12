import { formatNumberVN } from "@/utils/number.format";
// UC31.2: how the history of reviews and the duty of peer review are put into words. Apart from the page so it can be tested.
import type {
  IReviewHistoryItem,
  IReviewObligation,
  TObligationStatus,
} from "@/types/assessment.types";

export type DutyTone = "success" | "warning" | "error" | "info" | "neutral";

/** What the Learner reads for each state of the duty (the rule is the one that decides the Certificate). */
export const obligationView = (
  status: TObligationStatus,
): { label: string; tone: DutyTone; help: string } => {
  switch (status) {
    case "Satisfied":
      return {
        label: "Hoàn thành",
        tone: "success",
        help: "Bạn đã chấm đủ các bài được giao.",
      };
    case "Waived":
      return {
        label: "Được miễn",
        tone: "info",
        help: "Giảng viên đã miễn nghĩa vụ chấm chéo của bạn ở bài tập này.",
      };
    case "Pending":
      return {
        label: "Đang thực hiện",
        tone: "warning",
        help: "Bạn còn bài cần chấm trước hạn.",
      };
    case "Missed":
      return {
        label: "Chưa hoàn thành",
        tone: "error",
        help: "Có bài được giao đã quá hạn mà chưa chấm. Hãy nộp lại bài để được giao chấm ở chu kỳ sau và chấm đủ các bài đó, hoặc nhờ giảng viên miễn nghĩa vụ.",
      };
    default:
      return {
        label: "Không áp dụng",
        tone: "neutral",
        help: "Bạn chưa được giao bài chấm chéo nào.",
      };
  }
};

/** The line above the table: how many were handed out and how many were given. */
export const dutyLine = (assigned: number, completed: number): string =>
  assigned === 0
    ? "Bạn chưa được giao bài chấm chéo nào."
    : `Số bài được giao: ${assigned}. Đã chấm: ${completed}.`;

/** The Assignment's own count: "1/2 bài". */
export const progressText = (obligation: IReviewObligation): string =>
  `${obligation.completedCount}/${obligation.requiredCount} bài`;

/** A score on 0-100 as the Learner reads it: 66.67 → "66,67", null → "-". */
export const scoreText = (score: number | null): string =>
  score === null
    ? "-"
    : formatNumberVN(score);

/** What the Learner calls a review without knowing the author: the end of its id, like the queue. */
export const reviewLabel = (item: Pick<IReviewHistoryItem, "id">): string =>
  `Bài nộp ${item.id.slice(-4).toUpperCase()}`;

export const formatReviewTime = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

/** "Nội dung 55/60 · Trình bày 35/40" */
export const criteriaLine = (item: IReviewHistoryItem): string =>
  item.criteria.map((c) => `${c.name} ${formatNumberVN(c.points)}/${formatNumberVN(c.maxPoints)}`).join(" · ");
