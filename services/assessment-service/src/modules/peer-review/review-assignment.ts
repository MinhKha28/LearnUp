/** The ring that decides who reviews whose submission when a peer review cycle closes (BR-248, BR-249). */

export interface ReviewPair {
  /** The Learner whose submission is reviewed. */
  authorId: string;
  reviewerId: string;
}

/**
 * Fisher-Yates shuffle. `random` returns a number in [0, 1) and is replaced by a test to make the result known.
 * The input is not changed.
 */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** BR-242: with fewer than N + 1 submissions there is nobody to swap with, so nothing is assigned. */
export const canAssign = (submitters: number, reviewersPerSubmission: number) =>
  submitters >= reviewersPerSubmission + 1;

/**
 * BR-249: the submission of the Learner at position i of the permutation goes to the Learners at positions
 * i + 1 ... i + N, counted around the ring. With m >= N + 1 Learners that gives every submission exactly N
 * different reviewers, none of them its own author, and every Learner exactly N submissions to review.
 * The same permutation always gives the same pairs, so closing a cycle again changes nothing.
 */
export function assignReviews(
  permutation: readonly string[],
  reviewersPerSubmission: number,
): ReviewPair[] {
  const m = permutation.length;
  if (!canAssign(m, reviewersPerSubmission)) return [];
  const pairs: ReviewPair[] = [];
  for (let i = 0; i < m; i += 1) {
    for (let k = 1; k <= reviewersPerSubmission; k += 1) {
      pairs.push({
        authorId: permutation[i],
        reviewerId: permutation[(i + k) % m],
      });
    }
  }
  return pairs;
}
