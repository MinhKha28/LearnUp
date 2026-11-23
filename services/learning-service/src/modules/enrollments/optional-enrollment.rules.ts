import { createApiError } from '@learnup/ts-common';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { OptionalEnrollmentRow } from './optional-enrollment.repository';

export function assertWithdrawable(
  row: OptionalEnrollmentRow | null,
): asserts row is OptionalEnrollmentRow {
  if (!row || row.status === 'Withdrawn')
    throw new NotFoundException(
      createApiError('ENROLLMENT_NOT_FOUND', 'Không tìm thấy đăng ký Course.'),
    );
  const reason =
    row.enrollmentType === 'Required'
      ? 'REQUIRED'
      : row.status === 'Completed'
        ? 'COMPLETED'
        : null;
  if (reason)
    throw new ConflictException({
      ...createApiError(
        'ENROLLMENT_NOT_WITHDRAWABLE',
        'Không thể rút khỏi Course này.',
      ),
      reason,
    });
}

/** UC25.3 self-enrolment may restore these; AccountDeleted and HaltedClosed stay blocked. */
const SELF_RESTORABLE_REASONS: readonly string[] = [
  'LearnerWithdrew',
  // UC24.4: an Organizer-cancelled assignment is restored as Optional.
  'OrganizerCancelled',
];

export function assertRestorable(row: OptionalEnrollmentRow | null): void {
  if (!row) return;
  if (row.status !== 'Withdrawn')
    throw new ConflictException({
      ...createApiError('ALREADY_ENROLLED', 'Bạn đã đăng ký Course này'),
      enrollmentId: row.id,
    });
  if (!SELF_RESTORABLE_REASONS.includes(row.withdrawnReason ?? ''))
    throw new ConflictException({
      ...createApiError(
        'ENROLLMENT_NOT_RESTORABLE',
        'Không thể khôi phục đăng ký Course này.',
      ),
      reason: row.withdrawnReason,
    });
}
