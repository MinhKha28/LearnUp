import { createApiError } from '@learnup/ts-common';
import { ConflictException, type LoggerService } from '@nestjs/common';

export class OptionalInsertConflict extends Error {}
export const concurrentChange = () =>
  new ConflictException(
    createApiError(
      'CONCURRENT_CHANGE',
      'Dữ liệu phân công đã thay đổi, vui lòng thử lại.',
    ),
  );

/** Chỉ thử lại transaction khi Optional chen vào trước INSERT; Required dừng ngay. */
export async function runAssignmentTransaction<T>(
  run: () => Promise<T>,
  logger: Pick<LoggerService, 'debug' | 'warn'>,
  courseId: string,
  learnerCount: number,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    logger.debug?.(
      `Assignment transaction courseId=${courseId} learnerCount=${learnerCount} retryCount=${attempt - 1}`,
    );
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof OptionalInsertConflict)) throw error;
      if (attempt === 3) {
        logger.warn(
          `Assignment transaction exhausted courseId=${courseId} learnerCount=${learnerCount} retryCount=2`,
        );
        throw concurrentChange();
      }
    }
  }
  throw concurrentChange();
}
