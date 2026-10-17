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

export function assertRestorable(row: OptionalEnrollmentRow | null): void {
  if (!row) return;
  if (row.status !== 'Withdrawn')
    throw new ConflictException({
      ...createApiError('ALREADY_ENROLLED', 'Bạn đã đăng ký Course này'),
      enrollmentId: row.id,
    });
  if (row.withdrawnReason !== 'LearnerWithdrew')
    throw new ConflictException({
      ...createApiError(
        'ENROLLMENT_NOT_RESTORABLE',
        'Không thể khôi phục đăng ký Course này.',
      ),
      reason: row.withdrawnReason,
    });
}
