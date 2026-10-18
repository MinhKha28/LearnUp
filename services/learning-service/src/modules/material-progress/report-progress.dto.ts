import {
  HttpException,
  HttpStatus,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { WatchedRange } from './video-progress.rules';

export interface ReportProgressDto {
  ranges: WatchedRange[];
}

@Injectable()
export class ReportProgressPipe implements PipeTransform<
  unknown,
  ReportProgressDto
> {
  transform(value: unknown): ReportProgressDto {
    const body = value as Partial<ReportProgressDto> | null;
    const fail = () =>
      new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'ranges phải gồm 1–20 cặp số hữu hạn, 0 ≤ start < end.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== 'ranges') ||
      !Array.isArray(body.ranges) ||
      body.ranges.length < 1 ||
      body.ranges.length > 20
    )
      throw fail();
    for (const pair of body.ranges) {
      if (
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        !pair.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
        pair[0] < 0 ||
        pair[0] >= pair[1]
      )
        throw fail();
    }
    return { ranges: body.ranges };
  }
}
