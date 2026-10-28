import type { CurrentUser } from '@learnup/ts-common';
import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import type { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * A call from another service on behalf of no user (learning-service asking for a completion snapshot): the guard checks
 * the internal key and the `x-organization-id` header only, and asks for no user or role.
 */
export const SERVICE_CALL_KEY = 'isServiceCall';
export const ServiceCall = () => SetMetadata(SERVICE_CALL_KEY, true);

/** Trim text before validation so `@IsNotEmpty()` also rejects a value made only of spaces. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export const RESPONSE_MESSAGE = 'response_message';
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE, message);

interface RequestWithUser extends Request {
  user: CurrentUser;
  serviceOrganizationId?: string;
}

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);

/** The Organization of a `@ServiceCall()`, taken from the header by the guard. */
export const ServiceOrganization = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<RequestWithUser>().serviceOrganizationId!,
);
