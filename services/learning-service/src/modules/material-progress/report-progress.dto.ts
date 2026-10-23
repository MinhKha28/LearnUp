import {
  HttpException,
  HttpStatus,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import type { WatchedRange } from './video-progress.rules';

export interface ReportProgressDto {
  ranges: WatchedRange[];
  positionSeconds: number;
  reportedAt: string;
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
          message:
            'ranges gồm 0–20 cặp số hữu hạn (0 ≤ start < end), positionSeconds là số nguyên không âm và reportedAt là thời điểm ISO hợp lệ.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => !['ranges', 'positionSeconds', 'reportedAt'].includes(key),
      ) ||
      !Array.isArray(body.ranges) ||
      body.ranges.length > 20 ||
      !Number.isSafeInteger(body.positionSeconds) ||
      body.positionSeconds! < 0 ||
      typeof body.reportedAt !== 'string' ||
      !isISO8601(body.reportedAt, { strict: true, strictSeparator: true }) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(body.reportedAt) ||
      !Number.isFinite(Date.parse(body.reportedAt))
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
    return {
      ranges: body.ranges,
      positionSeconds: body.positionSeconds!,
      reportedAt: body.reportedAt,
    };
  }
}
