import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import {
  TenantContextInterceptor,
  REQUEST_CONTEXT_KEY,
} from '../../src/context/tenant-context.interceptor';
import { HeaderConstants } from '../../src/context/header.constants';
import { CURRENT_USER_KEY } from '../../src/auth/current-user.decorator';
import { PlatformRole } from '../../src/auth/roles.constant';
import { TenantContext } from '../../src/context/tenant-context';

describe('TenantContextInterceptor', () => {
  let interceptor: TenantContextInterceptor;

  beforeEach(() => {
    interceptor = new TenantContextInterceptor();
  });

  it('should extract internal headers and populate request context and TenantContext', (done) => {
    const req: Record<string, unknown> = {
      headers: {
        [HeaderConstants.X_USER_ID]: 'usr_456',
        [HeaderConstants.X_ORGANIZATION_ID]: 'org_789',
        [HeaderConstants.X_CORRELATION_ID]: 'corr_123',
        [HeaderConstants.X_USER_ROLE]: 'ORGANIZER',
      },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;

    const callHandler: CallHandler = {
      handle: () => {
        expect(req[REQUEST_CONTEXT_KEY]).toEqual({
          userId: 'usr_456',
          organizationId: 'org_789',
          role: PlatformRole.ORGANIZER,
          correlationId: 'corr_123',
        });
        expect(req[CURRENT_USER_KEY]).toBeDefined();
        expect(TenantContext.getOrganizationId()).toBe('org_789');
        return of('response_data');
      },
    };

    interceptor.intercept(context, callHandler).subscribe({
      next: (val) => {
        expect(val).toBe('response_data');
        done();
      },
      error: done,
    });
  });
});
