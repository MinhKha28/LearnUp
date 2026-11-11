import { createApiError, STANDARD_ERROR_CODES } from '@learnup/ts-common';
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseCatalogKeywordPipe implements PipeTransform<unknown, string | undefined> {
  transform(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.includes('\0')) throw this.invalidKeyword();

    const keyword = value.trim();
    if ([...keyword].length > 200) throw this.invalidKeyword();
    return keyword.replace(/\s+/g, ' ') || undefined;
  }

  private invalidKeyword(): BadRequestException {
    return new BadRequestException(
      createApiError(
        STANDARD_ERROR_CODES.VALIDATION_ERROR,
        'q phải là chuỗi có tối đa 200 ký tự.',
      ),
    );
  }
}
