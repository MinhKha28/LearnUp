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

export function assertExemptible(status: string) {
  if (status !== 'InProgress')
    throw new ConflictException(
      createApiError(
        'ENROLLMENT_NOT_EXEMPTIBLE',
        'Chỉ có thể miễn phân công đang học.',
      ),
    );
}

/** BR-171: hạn mới phải sau hạn hiện tại và không trước hôm nay. */
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
  return BigInt((newDueAt.getTime() - previousDueAt.getTime()) / 1000);
}
