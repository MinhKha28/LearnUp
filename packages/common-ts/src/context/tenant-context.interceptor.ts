import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { HeaderConstants } from './header.constants';
import { RequestContext } from './request-context.interface';
import { PlatformRoleType, isValidRole } from '../auth/roles.constant';
import { CurrentUser } from '../auth/current-user';
import { CURRENT_USER_KEY } from '../auth/current-user.decorator';
import { TenantContext } from './tenant-context';

export const REQUEST_CONTEXT_KEY = 'LEARNUP_REQUEST_CONTEXT';

/**
 * NestJS Interceptor that extracts authenticated internal headers (X-User-ID, X-Organization-ID, X-Correlation-ID)
 * injected by Spring Cloud Gateway and populates both Request object context and TenantContext AsyncLocalStorage.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();

    if (req) {
      const userId = req.headers[HeaderConstants.X_USER_ID] as string | undefined;
      const organizationId = req.headers[HeaderConstants.X_ORGANIZATION_ID] as string | undefined;
      const correlationId = req.headers[HeaderConstants.X_CORRELATION_ID] as string | undefined;
      const roleHeader = req.headers[HeaderConstants.X_USER_ROLE] as string | undefined;

      const role: PlatformRoleType | undefined =
        roleHeader && isValidRole(roleHeader)
          ? (roleHeader.toUpperCase() as PlatformRoleType)
          : undefined;

      const requestContext: RequestContext = {
        userId,
        organizationId,
        role,
        correlationId,
      };

      req[REQUEST_CONTEXT_KEY] = requestContext;

      if (userId && organizationId && role) {
        const currentUser = new CurrentUser({
          userId,
          organizationId,
          role,
          correlationId,
        });
        req[CURRENT_USER_KEY] = currentUser;
      }

      if (organizationId) {
        return new Observable((observer) => {
          TenantContext.runWithTenant(organizationId, () => {
            next.handle().subscribe(observer);
          });
        });
      }
    }

    return next.handle();
  }
}
