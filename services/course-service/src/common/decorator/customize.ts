import type { CurrentUser } from '@learnup/ts-common';
import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_SERVICE_CALL_KEY = 'isServiceCall';
export const ServiceCall = () => SetMetadata(IS_SERVICE_CALL_KEY, true);

export const RESPONSE_MESSAGE = 'response_message';
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE, message);

// Phân quyền theo role.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: CurrentUser['role'][]) =>
  SetMetadata(ROLES_KEY, roles);

// Yêu cầu có Organization Context.
export const REQUIRE_ORGANIZATION_KEY = 'requireOrganization';
export const RequireOrganization = () =>
  SetMetadata(REQUIRE_ORGANIZATION_KEY, true);

interface RequestWithUser extends Request {
  user: CurrentUser;
}

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
