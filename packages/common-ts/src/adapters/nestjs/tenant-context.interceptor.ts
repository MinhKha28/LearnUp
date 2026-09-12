import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { HeaderConstants } from '../../core/constants/headers.constant';
import { RequestContext } from '../../core/context/request-context.interface';
import { PlatformRoleType, isValidRole } from '../../core/constants/roles.constant';

export const REQUEST_CONTEXT_KEY = 'LEARNUP_REQUEST_CONTEXT';

/**
 * NestJS Interceptor to extract validated internal headers (X-User-ID, X-Organization-ID)
 * from API Gateway and attach them to the request object.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (req) {
      const userId = req.headers[HeaderConstants.X_USER_ID] as string | undefined;
      const organizationId = req.headers[HeaderConstants.X_ORGANIZATION_ID] as string | undefined;
      const correlationId = req.headers[HeaderConstants.X_CORRELATION_ID] as string | undefined;
      const roleHeader = req.headers['x-user-role'] as string | undefined;

      const role: PlatformRoleType | undefined = roleHeader && isValidRole(roleHeader)
        ? (roleHeader.toUpperCase() as PlatformRoleType)
        : undefined;

      const requestContext: RequestContext = {
        userId,
        organizationId,
        role,
        correlationId,
      };

      req[REQUEST_CONTEXT_KEY] = requestContext;
    }

    return next.handle();
  }
}
