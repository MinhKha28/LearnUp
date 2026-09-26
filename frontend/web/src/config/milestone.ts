export type Milestone = 1 | 2 | 3;

export const DEFAULT_MILESTONE: Milestone = 1;

const MILESTONES: readonly string[] = ['1', '2', '3'];

/** "1" | "2" | "3" → that milestone; anything else (missing, "4", "abc", " 2") → DEFAULT_MILESTONE. */
export const parseMilestone = (value: string | undefined): Milestone =>
  value !== undefined && MILESTONES.includes(value)
    ? (Number(value) as Milestone)
    : DEFAULT_MILESTONE;

/**
 * Delivery milestone the app is built for, from VITE_MILESTONE. Navigation items and their routes
 * with availableFrom above this value stay hidden until that milestone ships.
 */
export const CURRENT_MILESTONE: Milestone = parseMilestone(import.meta.env.VITE_MILESTONE);
