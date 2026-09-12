import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestContext } from './request-context.interface';
import { REQUEST_CONTEXT_KEY } from './tenant-context.interceptor';

/**
 * Parameter decorator to inject the current RequestContext into route handlers.
 *
 * Example:
 *   @Get()
 *   findAll(@TenantContextDecorator() ctx: RequestContext) { ... }
 */
export const TenantContextDecorator = createParamDecorator(
  (data: keyof RequestContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const context: RequestContext = request?.[REQUEST_CONTEXT_KEY] || {};
    return data ? context[data] : context;
  },
);

/**
 * Parameter decorator to directly extract the active organizationId string.
 *
 * Example:
 *   @Get()
 *   listCourses(@CurrentTenant() organizationId: string) { ... }
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const context: RequestContext = request?.[REQUEST_CONTEXT_KEY];
    return context?.organizationId;
  },
);
