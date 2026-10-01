import {
  createApiError,
  STANDARD_ERROR_CODES,
  type CurrentUser,
  type UserRole,
} from '@learnup/ts-common';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorator/roles.decorator';

/**
 * Kiểm role theo @Roles(...). Chạy sau InternalAuthGuard (đăng ký APP_GUARD sau), nên request.user đã có.
 * Handler không có @Roles thì không kiểm.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) {
      return true;
    }

    const user = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUser }>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException(
        createApiError(
          STANDARD_ERROR_CODES.FORBIDDEN,
          'You do not have permission to perform this action.',
        ),
      );
    }
    return true;
  }
}
