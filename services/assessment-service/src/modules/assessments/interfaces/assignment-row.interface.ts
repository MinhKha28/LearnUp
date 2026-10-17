import type { Prisma } from 'generated/prisma/browser';
import type { assignmentInclude } from '../assessments.repository';

/** An Assignment as the repository loads it: Rubric criteria and the number of submissions included. */
export type AssignmentRow = Prisma.AssessmentGetPayload<{
  include: typeof assignmentInclude;
}>;

/** A list row only needs the number of submissions (BR-98). */
export type AssignmentListRow = Prisma.AssessmentGetPayload<{
  include: { _count: { select: { submissions: true } } };
}>;
