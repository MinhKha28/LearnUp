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
import { isUUID } from 'class-validator';
import { IS_PUBLIC_KEY, SERVICE_CALL_KEY } from '../decorator/customize';

interface AuthenticatedRequest extends Request {
  user?: CurrentUser;
  serviceOrganizationId?: string;
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

    if (
      typeof internalKey !== 'string' ||
      internalKey !== expectedInternalKey
    ) {
      throw new UnauthorizedException(
        'Invalid or missing internal service key.',
      );
    }

    const isServiceCall = this.reflector.getAllAndOverride<boolean>(
      SERVICE_CALL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isServiceCall) {
      const organization = request.headers[HEADER_NAMES.ORGANIZATION_ID];
      if (typeof organization !== 'string' || !isUUID(organization, 'all')) {
        throw new UnauthorizedException('Missing organization context.');
      }
      request.serviceOrganizationId = organization;
      return true;
    }

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

    request.user = {
      userId,
      organizationId,
      role,
      isAuthenticated: true,
    };

    return true;
  }
}
