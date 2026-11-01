import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES, parseUserRole } from '@learnup/ts-common';
import { IS_PUBLIC_KEY, IS_SERVICE_CALL_KEY } from '../decorator/customize';

interface AuthenticatedRequest extends Request {
  user?: CurrentUser;
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const internalKey = request.headers[HEADER_NAMES.INTERNAL_KEY];
    const expectedInternalKey = this.configService.getOrThrow<string>(
      'INTERNAL_SERVICE_KEY',
    );

    if (!this.internalKeyMatches(internalKey, expectedInternalKey)) {
      throw new UnauthorizedException(
        'Invalid or missing internal service key.',
      );
    }

    const isServiceCall = this.reflector.getAllAndOverride<boolean>(
      IS_SERVICE_CALL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isServiceCall) return true;

    const userId = request.headers[HEADER_NAMES.USER_ID];
    const organizationId = request.headers[HEADER_NAMES.ORGANIZATION_ID];
    const rawRole = request.headers[HEADER_NAMES.USER_ROLE];
    const role = typeof rawRole === 'string' ? parseUserRole(rawRole) : null;

    const platformAdmin = role === 'ADMIN' && organizationId === undefined;
    if (
      typeof userId !== 'string' ||
      !role ||
      (typeof organizationId !== 'string' && !platformAdmin)
    ) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    request.user = {
      userId,
      ...(typeof organizationId === 'string' && { organizationId }),
      role,
      isAuthenticated: true,
    };

    return true;
  }

  /** So bằng digest cùng độ dài để thời gian so sánh không lộ khóa hay độ dài khóa. */
  private internalKeyMatches(supplied: unknown, expected: string): boolean {
    if (typeof supplied !== 'string') return false;
    const digest = (value: string) =>
      createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(supplied), digest(expected));
  }
}
