import { createApiError, STANDARD_ERROR_CODES } from '@learnup/ts-common';
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Số trang của danh mục: số nguyên ≥ 1, mặc định 1.
 * ValidationPipe toàn cục đã đổi chuỗi query sang number ('abc' → NaN, thiếu → undefined).
 */
@Injectable()
export class ParsePagePipe implements PipeTransform<
  number | undefined,
  number
> {
  transform(value: number | undefined): number {
    if (value === undefined) {
      return 1;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException(
        createApiError(
          STANDARD_ERROR_CODES.VALIDATION_ERROR,
          'page phải là số nguyên lớn hơn hoặc bằng 1.',
        ),
      );
    }
    return value;
  }
}
