export type AssignmentStatus =
  | "NotStarted"
  | "InProgress"
  | "Overdue"
  | "Completed"
  | "Exempted"
  | "Halted"
  | "Withdrawn";
export interface Assignment {
  enrollmentId: string;
  learner: {
    id: string;
    fullName: string;
    email: string;
    status: string;
    activatedAt: string | null;
    deletedAt: string | null;
  } | null;
  course: { id: string; title: string; versionNumber: number } | null;
  assignedAt: string | null;
  dueAt: string | null;
  dueTimezone: string | null;
  status: AssignmentStatus;
  requiredCompleted: number;
  requiredTotal: number;
}
export interface AssignmentPage {
  items: Assignment[];
  page: number;
  pageSize: number;
  total: number;
}
export interface AssignmentDetail extends Assignment {
  organizationTimezone: string | null;
  baseDueAt: string | null;
  extensionSeconds: number;
  firstActivityAt: string | null;
  completedAt: string | null;
  completedLate: boolean | null;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  intervals: {
    kind: "Exempted" | "Halted";
    startedAt: string;
    endedAt: string | null;
    reason: string | null;
  }[];
}
export type InvalidLearnerReason =
  | "NOT_IN_ORGANIZATION"
  | "NOT_A_LEARNER"
  | "ACCOUNT_DELETED"
  | "ACCOUNT_DEACTIVATED"
  | "ALREADY_ASSIGNED";
export interface InvalidLearner {
  learnerId: string;
  reason: InvalidLearnerReason;
}
export interface AssignmentResult {
  created: number;
  converted: number;
  completedOnAssign: number;
  restored: number;
}
