import type { IGradingResult } from './interfaces/learner-submission.interface';

/** UC32.2 writes the role of the Instructor as 'Instructor'; the comparison ignores the case, so an old or other spelling still counts. */
const INSTRUCTOR_ROLE = 'instructor';

interface RubricCriterionInput {
  id: string;
  name: string;
  maxPoints: number;
}

interface ValidReview {
  reviewerRole: string;
  comment: string | null;
  completedAt: Date | null;
  scores: { criterionId: string; points: number }[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * UC30.2 (BR-208, BR-322, BR-191): the per-criterion averages and the comments of the valid reviews.
 * It never reads a reviewer id; a comment only says whether it came from a peer or from the Instructor.
 * The reviews passed in are the Completed ones: a review counts only with a score for every criterion (BR-324).
 */
export function buildGradingResult(
  rubric: RubricCriterionInput[],
  reviews: ValidReview[],
): Pick<IGradingResult, 'criteria' | 'comments'> {
  const criteria = rubric.map((criterion) => {
    const points = reviews.flatMap((review) =>
      review.scores
        .filter((score) => score.criterionId === criterion.id)
        .map((score) => score.points),
    );
    return {
      id: criterion.id,
      name: criterion.name,
      maxPoints: criterion.maxPoints,
      averagePoints: points.length
        ? round2(points.reduce((sum, p) => sum + p, 0) / points.length)
        : null,
    };
  });

  const comments = reviews
    .filter((review) => review.comment && review.comment.trim())
    .sort(
      (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
    )
    .map((review) => ({
      source:
        review.reviewerRole.toLowerCase() === INSTRUCTOR_ROLE
          ? ('INSTRUCTOR' as const)
          : ('PEER' as const),
      comment: review.comment as string,
      completedAt: review.completedAt ? review.completedAt.toISOString() : null,
    }));

  return { criteria, comments };
}
