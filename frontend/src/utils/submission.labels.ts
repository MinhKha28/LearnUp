import { formatDateTimeVN } from "@/utils/helper";
import type { ISubmissionPerson } from "@/types/submission.types";

export type LabelTone = "neutral" | "success" | "warning" | "error" | "info";

const GRADING_STATUS: Record<string, { label: string; tone: LabelTone }> = {
  AwaitingPeerReview: { label: "Đang chấm chéo", tone: "info" },
  AwaitingInstructor: { label: "Chờ bạn chấm", tone: "warning" },
  AwaitingFinalization: { label: "Chờ chốt điểm", tone: "info" },
  Finalized: { label: "Đã chốt điểm", tone: "success" },
  Pending: { label: "Chưa xử lý", tone: "neutral" },
};

const INTERVENTION_REASON: Record<string, string> = {
  PEER_REVIEW_DISABLED: "Bài tập không bật chấm chéo",
  NOT_ENOUGH_SUBMISSIONS: "Không đủ bài nộp để chấm chéo",
  REVIEWER_MISSED_DEADLINE: "Có người chấm không hoàn thành đúng hạn",
  REVIEW_MISSED: "Có người chấm không hoàn thành đúng hạn",
  REVIEWER_DEACTIVATED: "Có người chấm đã bị vô hiệu hóa",
  SCORE_GAP_EXCEEDED: "Điểm giữa các người chấm chênh lệch quá lớn",
  RESUBMITTED_AFTER_CUTOFF: "Nộp lại sau ngày chốt của chu kỳ",
};

const REVIEW_STATUS: Record<string, { label: string; tone: LabelTone }> = {
  Completed: { label: "Đã chấm", tone: "success" },
  Pending: { label: "Chưa chấm", tone: "neutral" },
  Missed: { label: "Bỏ lỡ", tone: "warning" },
  Waived: { label: "Được miễn", tone: "info" },
};

export const reviewStatusView = (status: string) =>
  REVIEW_STATUS[status] ?? { label: status, tone: "neutral" as LabelTone };

export const reviewerRoleLabel = (role: string) =>
  role === "Instructor" ? "Giảng viên" : role === "Learner" ? "Học viên" : role;

export const gradingStatusView = (status: string) =>
  GRADING_STATUS[status] ?? { label: status, tone: "neutral" as LabelTone };

export const interventionLabel = (reason: string | null) =>
  reason ? (INTERVENTION_REASON[reason] ?? reason) : null;

export const personName = (person: ISubmissionPerson) =>
  person.fullName ?? `Học viên ${person.id.slice(-4).toUpperCase()}`;

export const formatDateTime = formatDateTimeVN;

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes >= 1024 ** 2) return `${+(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${+(bytes / 1024).toFixed(1)} KB`;
};
