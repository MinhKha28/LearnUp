import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorator/customize';
import { CurrentUser, HEADER_NAMES, parseUserRole } from '@learnup/ts-common';

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
    // 1. Check endpoint public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 2. Verify request thực sự đến từ Gateway
    const internalKey = request.headers[HEADER_NAMES.INTERNAL_KEY];
    const expectedInternalKey = this.configService.getOrThrow<string>(
      'INTERNAL_SERVICE_KEY',
    );

    if (
      typeof internalKey !== 'string' ||
      internalKey !== expectedInternalKey
    ) {
      throw new UnauthorizedException(
        'Invalid or missing internal service key.',
      );
    }

    // 3. Lấy user context do Gateway truyền xuống
    const userId = request.headers[HEADER_NAMES.USER_ID];
    const organizationId = request.headers[HEADER_NAMES.ORGANIZATION_ID];
    const rawRole = request.headers[HEADER_NAMES.USER_ROLE];
    const role = typeof rawRole === 'string' ? parseUserRole(rawRole) : null;
    if (
      typeof userId !== 'string' ||
      typeof organizationId !== 'string' ||
      !role
    ) {
      throw new UnauthorizedException('Missing authenticated user context.');
    }

    // 4. Gắn user vào request
    request.user = {
      userId,
      organizationId,
      role,
      isAuthenticated: true,
    };

    return true;
  }
}
