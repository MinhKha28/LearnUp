import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { REQUEST_CONTEXT_KEY } from './tenant-context.interceptor';
import { RequestContext } from '../../core/context/request-context.interface';

/**
 * Parameter decorator to inject the current RequestContext into route handlers.
 *
 * Example:
 *   @Get()
 *   findAll(@TenantContext() ctx: RequestContext) { ... }
 */
export const TenantContext = createParamDecorator(
  (data: keyof RequestContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const context: RequestContext = request?.[REQUEST_CONTEXT_KEY] || {};
    return data ? context[data] : context;
  },
);
