import type { CurrentUser } from '@learnup/ts-common';
import { createApiError } from '@learnup/ts-common';
import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';

@Injectable()
export class EnrollmentRateLimitGuard extends ThrottlerGuard {
  protected getTracker(request: { user?: CurrentUser }): Promise<string> {
    if (!request.user?.userId) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }
    return Promise.resolve(request.user.userId);
  }

  protected generateKey(_context: ExecutionContext, tracker: string): string {
    return tracker;
  }

  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfterSeconds = Math.max(1, Math.ceil(detail.timeToBlockExpire));
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', retryAfterSeconds);
    throw new HttpException(
      {
        ...createApiError(
          'RATE_LIMITED',
          'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút',
        ),
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
