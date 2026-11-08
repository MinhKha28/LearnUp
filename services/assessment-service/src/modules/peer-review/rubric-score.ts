import { BadRequestException } from '@nestjs/common';

export const roundScore = (value: number): number =>
  Math.round(value * 100) / 100;

/**
 * BR-257, BR-202: a review of the Instructor (UC32.2) or of a Learner (UC31.1) has exactly one whole-number score for each
 * criterion of the Rubric, none above the maximum of its criterion. The score of the review is the points given over the
 * points possible, on the scale 0-100 with two decimals.
 */
export function scoreFromRubric(
  rubric: { id: string; maxPoints: number }[],
  scores: { criterionId: string; points: number }[],
): number {
  if (rubric.length === 0) {
    throw new BadRequestException({
      code: 'RUBRIC_MISSING',
      message: 'This Assignment has no Rubric criteria to grade against.',
    });
  }
  const given = new Map(scores.map((item) => [item.criterionId, item.points]));
  const incomplete = new BadRequestException({
    code: 'RUBRIC_SCORES_INCOMPLETE',
    message: 'Give exactly one score for every Rubric criterion.',
  });
  if (given.size !== scores.length || given.size !== rubric.length) {
    throw incomplete;
  }
  let earned = 0;
  let possible = 0;
  for (const criterion of rubric) {
    const points = given.get(criterion.id);
    if (points === undefined) throw incomplete;
    if (points > criterion.maxPoints) {
      throw new BadRequestException({
        code: 'RUBRIC_SCORE_OUT_OF_RANGE',
        message: `A criterion score cannot exceed ${criterion.maxPoints} points.`,
      });
    }
    earned += points;
    possible += criterion.maxPoints;
  }
  return roundScore((earned / possible) * 100);
}
