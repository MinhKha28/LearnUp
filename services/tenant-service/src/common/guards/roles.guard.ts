import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { CurrentUser, UserRole } from '@learnup/ts-common';
import { STANDARD_ERROR_CODES } from '@learnup/ts-common';
import { ROLES_KEY } from '../decorator/customize';

interface AuthenticatedRequest extends Request {
  user?: CurrentUser;
}

/**
 * Kiểm role của người gọi theo @Roles(). Chạy SAU InternalAuthGuard (guard toàn cục),
 * nên request.user đã có. Role so sánh theo dạng viết HOA của CurrentUser.
 * Gắn bằng @UseGuards ở từng controller, không đăng ký toàn cục.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.user?.role;
    if (!role || !roles.includes(role)) {
      throw new ForbiddenException({
        code: STANDARD_ERROR_CODES.FORBIDDEN,
        message: 'Bạn không có quyền thực hiện thao tác này.',
      });
    }
    return true;
  }
}
