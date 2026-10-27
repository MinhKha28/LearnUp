export interface INumberRule {
  required?: boolean;
  min?: number;
  max?: number;
  /** Whole numbers only. */
  integer?: boolean;
  /** Maximum number of decimal places (ignored when `integer` is set). */
  decimals?: number;
}

/**
 * Check a numeric form value. `NaN` means the user typed text that is not a number.
 * Returns the message to show, or null when the value is acceptable.
 */
export const validateNumber = (value: number | null, rule: INumberRule): string | null => {
  if (value === null) return rule.required ? "Enter a number." : null;
  if (!Number.isFinite(value)) return "Enter a valid number (digits only).";
  if (rule.integer && !Number.isInteger(value)) return "Must be a whole number.";
  if (!rule.integer && rule.decimals !== undefined) {
    const factor = 10 ** rule.decimals;
    if (Math.round(value * factor) / factor !== value) return `Use at most ${rule.decimals} decimal places.`;
  }
  if (rule.min !== undefined && value < rule.min) return `Must be at least ${rule.min}.`;
  if (rule.max !== undefined && value > rule.max) return `Must be at most ${rule.max}.`;
  return null;
};

/** Rubric criterion maximum score: a positive whole number (BR-315); the upper bound mirrors the API. */
/** UC19.2 step 3: a Rubric has 1 to 10 criteria. */
export const RUBRIC_MAX_CRITERIA = 10;
/** UC19.2 step 3: a criterion is worth 1 to 100 points. */
export const RUBRIC_POINTS_RULE: INumberRule = { required: true, integer: true, min: 1, max: 100 };

// Assignment settings: same limits as the API, so the form says "no" before the server does.
/** Passing score on the 0-100 scale, at most 2 decimals (BR-315). */
export const PASSING_SCORE_RULE: INumberRule = { required: true, min: 0, max: 100, decimals: 2 };
/** Estimated effort in whole minutes (BR-174). */
export const EFFORT_RULE: INumberRule = { required: true, integer: true, min: 1, max: 100000 };
/** n and m are optional on create (platform default) but whole numbers of at least 1 when given (BR-175). */
export const ATTEMPTS_RULE: INumberRule = { integer: true, min: 1, max: 1000 };
export const LOCK_HOURS_RULE: INumberRule = { integer: true, min: 1, max: 8760 };

// Quiz limits, same as the API (UC18.2 / UC18.4): time limit 1–1440 minutes, passing score above 0 up to 100 with 2 decimals.
export const TIME_LIMIT_RULE: INumberRule = { required: true, integer: true, min: 1, max: 1440 };
// With at most 2 decimals, "greater than 0" is the same as "at least 0.01".
export const QUIZ_PASSING_SCORE_RULE: INumberRule = { required: true, min: 0.01, max: 100, decimals: 2 };

// Peer Review settings (BR-183).
/** UC19.5 step 3: 2 to 5 reviewers for each submission. */
export const PEER_REVIEWERS_RULE: INumberRule = { required: true, integer: true, min: 2, max: 5 };
/** Cycle length and review deadline in days; optional because the platform default applies. */
export const PEER_DAYS_RULE: INumberRule = { integer: true, min: 1 };
/** Score gap that sends a submission to the Instructor, on the 0-100 scale (BR-321). */
export const PEER_SCORE_GAP_RULE: INumberRule = { required: true, min: 0, max: 100, decimals: 2 };
