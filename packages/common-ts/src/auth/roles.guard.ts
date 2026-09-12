import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { PlatformRoleType } from './roles.constant';
import { CURRENT_USER_KEY } from './current-user.decorator';
import { CurrentUser } from './current-user';
import { ForbiddenException } from '../exception/forbidden.exception';

/**
 * NestJS Guard that enforces RBAC authorization against @Roles() decorator metadata.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PlatformRoleType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: CurrentUser | undefined = request?.[CURRENT_USER_KEY];
    const roleHeader = request?.headers?.['x-user-role'] as string | undefined;

    const activeRole = user?.role || (roleHeader?.toUpperCase() as PlatformRoleType);

    if (!activeRole) {
      throw new ForbiddenException('Access denied. No active role found in request context.');
    }

    const hasPermission = requiredRoles.includes(activeRole);
    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied. Required role(s): [${requiredRoles.join(', ')}], current role: ${activeRole}`,
      );
    }

    return true;
  }
}
