import { describe, it, expect, vi, afterEach } from 'vitest';
import { DEFAULT_MILESTONE, parseMilestone } from '@/config/milestone';

/** Re-evaluates src/config/milestone.ts with VITE_MILESTONE set to `value` (undefined = unset). */
const loadMilestoneWith = async (value: string | undefined) => {
  // stubEnv(name, undefined) would store the string "undefined"; stub, then delete to unset.
  // unstubAllEnvs() restores the original value either way.
  vi.stubEnv('VITE_MILESTONE', value ?? '');
  if (value === undefined) {
    delete (import.meta.env as Record<string, unknown>).VITE_MILESTONE;
    expect('VITE_MILESTONE' in import.meta.env).toBe(false);
  }
  vi.resetModules();
  return (await import('@/config/milestone')).CURRENT_MILESTONE;
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('CURRENT_MILESTONE from VITE_MILESTONE', () => {
  it('defaults to milestone 1', () => {
    expect(DEFAULT_MILESTONE).toBe(1);
  });

  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
  ] as const)('accepts "%s"', async (value, expected) => {
    expect(parseMilestone(value)).toBe(expected);
    expect(await loadMilestoneWith(value)).toBe(expected);
  });

  it.each(['0', '4', '1.5', 'abc', ' 2', ''])('falls back to 1 for invalid "%s"', async (value) => {
    expect(parseMilestone(value)).toBe(1);
    expect(await loadMilestoneWith(value)).toBe(1);
  });

  it('falls back to 1 when it is not set', async () => {
    expect(parseMilestone(undefined)).toBe(1);
    expect(await loadMilestoneWith(undefined)).toBe(1);
  });
});
