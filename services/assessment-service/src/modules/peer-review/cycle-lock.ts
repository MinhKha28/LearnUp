/**
 * The advisory lock that serializes what happens to the cycles of one Assignment: a Learner placing a submission in a
 * cycle (UC30) and the closing of that cycle (UC33) take turns, so a submission is either in the cycle when it closes or
 * goes to the next one, never in between.
 */
export const cycleLockKey = (assessmentId: string): string =>
  `cycle:${assessmentId}`;
