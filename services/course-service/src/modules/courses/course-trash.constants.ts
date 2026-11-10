import { ConflictException } from '@nestjs/common';
import { COURSE_STATUS } from './course-values';

export const COURSE_TRASH_DAYS = 7;

export const COURSE_TRASH_MS = COURSE_TRASH_DAYS * 24 * 60 * 60 * 1000;

export const DELETABLE_COURSE_STATUSES = [
  COURSE_STATUS.DRAFT,
  COURSE_STATUS.REJECTED,
] as const;

export const EDITING_COURSE_STATUSES = [
  COURSE_STATUS.DRAFT,
  COURSE_STATUS.SUBMITTED,
  COURSE_STATUS.REJECTED,
] as const;

export function assertCourseNotInTrash(deletedAt: Date | null): void {
  if (deletedAt) {
    throw new ConflictException({
      code: 'COURSE_IN_TRASH',
      message: 'Course is in Trash.',
    });
  }
}

export function getPurgeAt(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + COURSE_TRASH_MS);
}

export function isTrashExpired(deletedAt: Date, now = new Date()): boolean {
  return getPurgeAt(deletedAt).getTime() <= now.getTime();
}
