import type { QuizQuestionType } from './interfaces/quiz-detail.interface';

/** quiz_questions.content VARCHAR(2000). */
export const QUESTION_CONTENT_MAX_LENGTH = 2000;
/** quiz_question_options.content VARCHAR(500). */
export const OPTION_CONTENT_MAX_LENGTH = 500;
/** UC18.2.1 (agreed with the team, no BR): a choice question has 2 to 10 options. */
export const QUESTION_OPTIONS_MIN = 2;
export const QUESTION_OPTIONS_MAX = 10;

/** The two options a TrueFalse question always has, in this order (same labels as the seed and the Learner screen). */
export const TRUE_FALSE_LABELS = { true: 'True', false: 'False' } as const;

export interface QuestionOptionInput {
  content: string;
  isCorrect: boolean;
}

export interface QuestionInput {
  type: QuizQuestionType;
  options?: QuestionOptionInput[];
  correctAnswer?: boolean;
}

/** What is wrong with the options of a question; empty when the question can be saved. */
export type QuestionRuleError =
  | 'OPTIONS_NOT_ALLOWED'
  | 'CORRECT_ANSWER_REQUIRED'
  | 'CORRECT_ANSWER_NOT_ALLOWED'
  | 'OPTIONS_REQUIRED'
  | 'OPTIONS_COUNT'
  | 'OPTIONS_DUPLICATED'
  | 'SINGLE_CORRECT_COUNT'
  | 'MULTIPLE_CORRECT_COUNT'
  | 'MULTIPLE_INCORRECT_COUNT';

export const QUESTION_RULE_MESSAGE: Record<QuestionRuleError, string> = {
  OPTIONS_NOT_ALLOWED:
    'A True / False question takes no options; send correctAnswer instead.',
  CORRECT_ANSWER_REQUIRED:
    'A True / False question needs correctAnswer (true or false).',
  CORRECT_ANSWER_NOT_ALLOWED:
    'correctAnswer is only for True / False questions; mark the correct options instead.',
  OPTIONS_REQUIRED: 'A choice question needs its answer options.',
  OPTIONS_COUNT: `A choice question needs ${QUESTION_OPTIONS_MIN} to ${QUESTION_OPTIONS_MAX} answer options.`,
  OPTIONS_DUPLICATED: 'Two answer options of this question have the same text.',
  SINGLE_CORRECT_COUNT:
    'A single-answer question needs exactly one correct option.',
  MULTIPLE_CORRECT_COUNT:
    'A multiple-answer question needs at least one correct option.',
  MULTIPLE_INCORRECT_COUNT:
    'A multiple-answer question needs at least one incorrect option.',
};

/**
 * BR-194 / BR-202: the answer key must say exactly which options are correct, per question type.
 * Pure: run after the DTO validation (texts already trimmed and non-empty). Returns every problem found.
 */
export function checkQuestionRules(input: QuestionInput): QuestionRuleError[] {
  const errors: QuestionRuleError[] = [];

  if (input.type === 'TrueFalse') {
    if (input.options !== undefined) errors.push('OPTIONS_NOT_ALLOWED');
    if (input.correctAnswer === undefined)
      errors.push('CORRECT_ANSWER_REQUIRED');
    return errors;
  }

  if (input.correctAnswer !== undefined)
    errors.push('CORRECT_ANSWER_NOT_ALLOWED');
  const options = input.options;
  if (!options) {
    errors.push('OPTIONS_REQUIRED');
    return errors;
  }
  if (
    options.length < QUESTION_OPTIONS_MIN ||
    options.length > QUESTION_OPTIONS_MAX
  ) {
    errors.push('OPTIONS_COUNT');
  }
  const texts = options.map((option) => option.content.trim().toLowerCase());
  if (new Set(texts).size !== texts.length) errors.push('OPTIONS_DUPLICATED');

  const correct = options.filter((option) => option.isCorrect).length;
  if (input.type === 'SingleChoice' && correct !== 1) {
    errors.push('SINGLE_CORRECT_COUNT');
  }
  if (input.type === 'MultipleChoice') {
    if (correct < 1) errors.push('MULTIPLE_CORRECT_COUNT');
    if (correct === options.length && options.length > 0)
      errors.push('MULTIPLE_INCORRECT_COUNT');
  }
  return errors;
}

/** The options to store, in display order: the ones sent, or True / False for a TrueFalse question. */
export function optionsToStore(input: QuestionInput): QuestionOptionInput[] {
  if (input.type === 'TrueFalse') {
    return [
      {
        content: TRUE_FALSE_LABELS.true,
        isCorrect: input.correctAnswer === true,
      },
      {
        content: TRUE_FALSE_LABELS.false,
        isCorrect: input.correctAnswer === false,
      },
    ];
  }
  return (input.options ?? []).map((option) => ({
    content: option.content,
    isCorrect: option.isCorrect,
  }));
}
