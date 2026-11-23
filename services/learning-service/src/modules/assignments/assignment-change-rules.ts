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

export function assertExemptionRemovable(status: string) {
  if (status !== 'Exempted')
    throw new ConflictException(
      createApiError(
        'ENROLLMENT_NOT_EXEMPTED',
        'Chỉ có thể gỡ miễn cho phân công đang được miễn.',
      ),
    );
}

export function assertCancellable(status: string) {
  if (status !== 'NotStarted')
    throw new ConflictException(
      createApiError(
        'ENROLLMENT_NOT_CANCELLABLE',
        'Không thể hủy phân công ở trạng thái hiện tại.',
      ),
    );
}

export function assertNoLearningData(hasLearningData: boolean) {
  if (hasLearningData)
    throw new ConflictException(
      createApiError(
        'ASSIGNMENT_HAS_LEARNING_DATA',
        'Học viên đã có dữ liệu học tập. Hãy dùng “Đánh dấu Miễn”.',
      ),
    );
}

/** BR-171: hạn mới phải sau hạn hiện tại và không trước hôm nay. */
export function validateExtension(
  previousDueAt: Date,
  newDueAt: Date,
  newDueDate: string,
  today: string,
  previousHasSubMillisecond = false,
) {
  const deltaMs = newDueAt.getTime() - previousDueAt.getTime();
  const seconds =
    Math.floor(deltaMs / 1000) -
    (previousHasSubMillisecond && deltaMs % 1000 === 0 ? 1 : 0);
  if (seconds <= 0)
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
  return BigInt(seconds);
}
