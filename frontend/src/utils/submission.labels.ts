import type { ISubmissionPerson } from "@/types/submission.types";

export type LabelTone = "neutral" | "success" | "warning" | "error" | "info";

const GRADING_STATUS: Record<string, { label: string; tone: LabelTone }> = {
  AwaitingPeerReview: { label: "In peer review", tone: "info" },
  AwaitingInstructor: { label: "Awaiting your grading", tone: "warning" },
  AwaitingFinalization: { label: "Ready to finalize", tone: "info" },
  Finalized: { label: "Finalized", tone: "success" },
  Pending: { label: "Pending", tone: "neutral" },
};

const INTERVENTION_REASON: Record<string, string> = {
  PEER_REVIEW_DISABLED: "Peer review is off",
  NOT_ENOUGH_SUBMISSIONS: "Not enough submissions for peer review",
  REVIEWER_MISSED_DEADLINE: "A reviewer missed the deadline",
  REVIEWER_DEACTIVATED: "A reviewer was deactivated",
  SCORE_GAP_EXCEEDED: "Reviewer scores differ too much",
  RESUBMITTED_AFTER_CUTOFF: "Resubmitted after the cycle cutoff",
};

export const gradingStatusView = (status: string) =>
  GRADING_STATUS[status] ?? { label: status, tone: "neutral" as LabelTone };

export const interventionLabel = (reason: string | null) =>
  reason ? (INTERVENTION_REASON[reason] ?? reason) : null;

export const personName = (person: ISubmissionPerson) =>
  person.fullName ?? `Learner ${person.id.slice(-4).toUpperCase()}`;

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes >= 1024 ** 2) return `${+(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${+(bytes / 1024).toFixed(1)} KB`;
};
