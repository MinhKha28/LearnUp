import { createApiError, STANDARD_ERROR_CODES } from '@learnup/ts-common';
import { BadRequestException } from '@nestjs/common';

export const MY_ENROLLMENT_TYPES = ['Required', 'Optional'] as const;
export const MY_ENROLLMENT_STATUSES = [
  'NotStarted',
  'InProgress',
  'Completed',
  'Overdue',
  'Exempted',
  'Halted',
] as const;

export interface MyEnrollmentFilters {
  q?: string;
  type?: (typeof MY_ENROLLMENT_TYPES)[number];
  status?: (typeof MY_ENROLLMENT_STATUSES)[number];
}

function invalidFilter(name: string): never {
  throw new BadRequestException(
    createApiError(
      STANDARD_ERROR_CODES.VALIDATION_ERROR,
      `Tham số ${name} không hợp lệ.`,
    ),
  );
}

function filterValue<T extends string>(
  name: string,
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  return allowed.find((option) => option === value) ?? invalidFilter(name);
}

export function parseMyEnrollmentFilters(
  q: unknown,
  type: unknown,
  status: unknown,
): MyEnrollmentFilters {
  if (q !== undefined && typeof q !== 'string') invalidFilter('q');
  const keyword = q?.trim();
  if (keyword && [...keyword].length > 200) invalidFilter('q');
  return {
    q: keyword || undefined,
    type: filterValue('type', type, MY_ENROLLMENT_TYPES),
    status: filterValue('status', status, MY_ENROLLMENT_STATUSES),
  };
}

export function normalizeCourseName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}
