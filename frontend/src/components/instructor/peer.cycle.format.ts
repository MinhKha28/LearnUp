/** A Learner the tenant does not know still has a row: the end of the id tells them apart. */
export const learnerLabel = (fullName: string, learnerId: string) =>
  fullName || `Learner …${learnerId.slice(-4)}`;
