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
export const RUBRIC_POINTS_RULE: INumberRule = { required: true, integer: true, min: 1, max: 1000 };
