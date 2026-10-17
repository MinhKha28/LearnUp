/** What the Instructor reads as the state of a peer review cycle (UC33 step 3). */
export type CycleStatus = 'Open' | 'Assigned' | 'InstructorOnly' | 'Completed';

const FINAL_STATUSES: readonly string[] = ['Assigned', 'InstructorOnly', 'Completed'];

/**
 * UC33 (BR-200, BR-206, BR-312): the status of a cycle.
 *  - The status the closing of the cycle wrote (Assigned, InstructorOnly, Completed) is always shown as it is.
 *  - Until the closing line, or while the closing has not run yet, the row says Open or what the closing will do:
 *    with fewer than N + 1 submissions there is nobody to swap with, so the Instructor grades them all (BR-206);
 *    otherwise the submissions are assigned.
 */
export function cycleStatusOf(input: {
  stored: string;
  closesAt: Date;
  reviewersPerSubmission: number;
  submissionCount: number;
  now: Date;
}): CycleStatus {
  if (FINAL_STATUSES.includes(input.stored)) return input.stored as CycleStatus;
  if (input.now.getTime() < input.closesAt.getTime()) return 'Open';
  return input.submissionCount < input.reviewersPerSubmission + 1
    ? 'InstructorOnly'
    : 'Assigned';
}
