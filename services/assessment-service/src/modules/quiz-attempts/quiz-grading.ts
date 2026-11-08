/** BR-197: the score of a Quiz attempt, on the scale of 0-100 with 2 decimal places. */
export const roundScore = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export interface GradableQuestion {
  id: string;
  /** Ids of the options marked as correct. */
  correctOptionIds: string[];
}

export interface GradeResult {
  correct: number;
  total: number;
  /** correct / total * 100, rounded to 2 decimal places; 0 when the Quiz has no question. */
  score: number;
}

/**
 * BR-197: every question weighs the same, a question is right only when the set of options chosen is exactly the set of
 * correct options (no partial credit), and a question left unanswered is wrong.
 */
export function gradeAttempt(
  questions: GradableQuestion[],
  answers: ReadonlyMap<string, readonly string[]>,
): GradeResult {
  let correct = 0;
  for (const question of questions) {
    const chosen = new Set(answers.get(question.id) ?? []);
    const key = new Set(question.correctOptionIds);
    if (
      chosen.size > 0 &&
      chosen.size === key.size &&
      [...key].every((id) => chosen.has(id))
    ) {
      correct += 1;
    }
  }
  const total = questions.length;
  return {
    correct,
    total,
    score: total === 0 ? 0 : roundScore((correct / total) * 100),
  };
}

/** What a question type allows to be chosen: one option for SingleChoice and TrueFalse, any number for MultipleChoice. */
export function allowsSeveralOptions(questionType: string): boolean {
  return questionType === 'MultipleChoice';
}

/**
 * The best attempt is the one BR-198 records: the highest score, the earlier attempt when scores tie.
 * Returns the id, or null when nothing was submitted.
 */
export function bestAttemptOf(
  attempts: {
    id: string;
    score: number | null;
    attemptNumber: number;
    submittedAt: Date | null;
  }[],
): string | null {
  let best: (typeof attempts)[number] | null = null;
  for (const attempt of attempts) {
    if (attempt.submittedAt === null || attempt.score === null) continue;
    if (
      best === null ||
      attempt.score > best.score! ||
      (attempt.score === best.score &&
        attempt.attemptNumber < best.attemptNumber)
    ) {
      best = attempt;
    }
  }
  return best?.id ?? null;
}
