import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES, parseUserRole } from '@learnup/ts-common';
import { isUUID } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import {
  IS_PUBLIC_KEY,
  IS_SERVICE_CALL_KEY,
  ROLES_KEY,
  REQUIRE_ORGANIZATION_KEY,
} from '../decorator/customize';

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
    const targets = [context.getHandler(), context.getClass()];

    // 1. Bỏ qua xác thực nếu endpoint là Public.
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      targets,
    );

    if (isPublic) return true;

    // 2. Xác thực internal service key.
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const internalKey = request.headers[HEADER_NAMES.INTERNAL_KEY];

    const expectedInternalKey = this.configService.getOrThrow<string>(
      'INTERNAL_SERVICE_KEY',
    );

    const isServiceCall = this.reflector.getAllAndOverride<boolean>(
      IS_SERVICE_CALL_KEY,
      targets,
    );
    if (isServiceCall) {
      const supplied = Buffer.from(
        typeof internalKey === 'string' ? internalKey : '',
      );
      const expected = Buffer.from(expectedInternalKey);
      if (
        !expectedInternalKey.trim() ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        throw new UnauthorizedException({
          code: 'INVALID_INTERNAL_KEY',
          message: 'Invalid or missing internal service key.',
        });
      }
      const organizationId = request.headers[HEADER_NAMES.ORGANIZATION_ID];
      if (
        typeof organizationId !== 'string' ||
        !isUUID(organizationId, 'all')
      ) {
        throw new BadRequestException({
          code: 'ORGANIZATION_REQUIRED',
          message: 'A valid organization header is required.',
        });
      }
      return true;
    }

    // Fail closed: a service that was started without a key must not accept a request whose key header is empty too.
    if (
      typeof internalKey !== 'string' ||
      !expectedInternalKey.trim() ||
      internalKey !== expectedInternalKey
    ) {
      throw new UnauthorizedException(
        'Invalid or missing internal service key.',
      );
    }

    // 3. Lấy user context từ headers.
    const userId = request.headers[HEADER_NAMES.USER_ID];
    const organizationId = request.headers[HEADER_NAMES.ORGANIZATION_ID];
    const rawRole = request.headers[HEADER_NAMES.USER_ROLE];

    const role = typeof rawRole === 'string' ? parseUserRole(rawRole) : null;

    if (
      typeof userId !== 'string' ||
      !isUUID(userId, 'all') ||
      typeof organizationId !== 'string' ||
      !role
    ) {
      throw new UnauthorizedException(
        'Missing or invalid authenticated user context.',
      );
    }

    request.user = {
      userId,
      organizationId,
      role,
      isAuthenticated: true,
    };

    // 4. Kiểm tra Role.
    const requiredRoles = this.reflector.getAllAndOverride<
      CurrentUser['role'][]
    >(ROLES_KEY, targets);

    if (requiredRoles?.length && !requiredRoles.includes(role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    // 5. Kiểm tra Organization Context.
    const requireOrganization = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ORGANIZATION_KEY,
      targets,
    );

    if (requireOrganization && !isUUID(organizationId, 'all')) {
      throw new ForbiddenException('Organization context is required.');
    }

    return true;
  }
}
