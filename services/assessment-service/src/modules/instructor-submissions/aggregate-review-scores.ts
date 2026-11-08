import { roundScore } from '../peer-review/rubric-score';
import { REVIEW_COMPLETED } from './instructor-submissions.constants';

export function aggregateReviewScores(
  reviews: readonly { status: string; score: { toString(): string } | null }[],
) {
  const validScores = reviews
    .filter(
      (review) => review.status === REVIEW_COMPLETED && review.score !== null,
    )
    .map((review) => Number(review.score));
  const validReviewCount = validScores.length;
  return validReviewCount === 0
    ? null
    : {
        validReviewCount,
        suggestedScore: roundScore(
          validScores.reduce((sum, score) => sum + score, 0) / validReviewCount,
        ),
      };
}
