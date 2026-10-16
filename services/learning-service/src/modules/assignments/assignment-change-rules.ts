import { createApiError } from '@learnup/ts-common';
import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

export function assertExtendable(status: string) {
  if (!['NotStarted', 'InProgress', 'Exempted', 'Halted'].includes(status))
    throw new ConflictException(
      createApiError(
        'ENROLLMENT_NOT_EXTENDABLE',
        'Không thể kéo dài hạn phân công ở trạng thái hiện tại.',
      ),
    );
}

export function validateExtension(
  previousDueAt: Date,
  newDueAt: Date,
  newDueDate: string,
  today: string,
) {
  if (newDueAt.getTime() <= previousDueAt.getTime())
    throw new UnprocessableEntityException(
      createApiError('DUE_DATE_NOT_LATER', 'Hạn mới phải sau hạn hiện tại.'),
    );
  if (newDueDate < today)
    throw new UnprocessableEntityException(
      createApiError(
        'DUE_DATE_IN_PAST',
        'Ngày hết hạn không được trước hôm nay.',
      ),
    );
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 365);
  if (newDueDate > limit.toISOString().slice(0, 10))
    throw new UnprocessableEntityException(
      createApiError(
        'DUE_DATE_TOO_FAR',
        'Ngày hết hạn không được quá 365 ngày kể từ hôm nay.',
      ),
    );
  return BigInt((newDueAt.getTime() - previousDueAt.getTime()) / 1000);
}
