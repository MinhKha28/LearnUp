import type { PageResponse } from '@learnup/ts-common';
import type { AssignmentSummary } from './assignment-summary.interface';

/** Same shape as the other list endpoints ({ meta, items }) plus the Course-level flags the UI needs. */
export interface AssignmentListPage extends PageResponse<AssignmentSummary> {
  /** BR-318: no new Assignment once the Course is Locked. */
  courseLocked: boolean;
  courseStatus: string;
}
