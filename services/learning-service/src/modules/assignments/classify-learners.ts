import type { LookupLearner } from '../../infrastructure/clients/tenant/tenant.client';

export type AssignmentKind =
  'CREATE' | 'CONVERT' | 'CONVERT_COMPLETED' | 'RESTORE';
export type InvalidLearnerReason =
  | 'NOT_IN_ORGANIZATION'
  | 'NOT_A_LEARNER'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_DEACTIVATED'
  | 'ALREADY_ASSIGNED';
export interface AssignmentEnrollment {
  id: string;
  learnerId: string;
  enrollmentType: string;
  status: string;
  firstActivityAt: Date | null;
}
export interface AssignmentPlan {
  learnerId: string;
  kind: AssignmentKind;
  existing?: AssignmentEnrollment;
}

/** D56–D59: lỗi theo thứ tự ưu tiên; Pending được phân công như Active. */
export function classifyLearners(
  learnerIds: string[],
  items: LookupLearner[],
  enrollments: AssignmentEnrollment[],
) {
  const users = new Map(items.map((item) => [item.userId, item]));
  const existing = new Map(enrollments.map((row) => [row.learnerId, row]));
  const errors: { learnerId: string; reason: InvalidLearnerReason }[] = [];
  const plans: AssignmentPlan[] = [];
  for (const learnerId of learnerIds) {
    const user = users.get(learnerId);
    const row = existing.get(learnerId);
    const reason: InvalidLearnerReason | null = !user
      ? 'NOT_IN_ORGANIZATION'
      : user.role !== 'Learner'
        ? 'NOT_A_LEARNER'
        : user.deletedAt !== null
          ? 'ACCOUNT_DELETED'
          : user.status === 'Deactivated'
            ? 'ACCOUNT_DEACTIVATED'
            : row?.enrollmentType === 'Required'
              ? 'ALREADY_ASSIGNED'
              : null;
    if (reason) {
      errors.push({ learnerId, reason });
      continue;
    }
    const kind: AssignmentKind = !row
      ? 'CREATE'
      : row.status === 'Withdrawn'
        ? 'RESTORE'
        : row.status === 'Completed'
          ? 'CONVERT_COMPLETED'
          : 'CONVERT';
    plans.push({ learnerId, kind, existing: row });
  }
  return { errors, plans };
}
