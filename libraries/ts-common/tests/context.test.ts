import { describe, expect, it } from 'vitest';
import {
  createCorrelationContext,
  createCurrentUser,
  createOrganizationContext,
  createRequestContext,
} from '../src/context/context.js';

describe('Context Models & Factories', () => {
  it('should create RequestContext with trimmed values', () => {
    const ctx = createRequestContext({
      userId: '  user-123  ',
      organizationId: '  org-456  ',
      role: 'ORGANIZER',
      correlationId: '  corr-789  ',
    });

    expect(ctx.userId).toBe('user-123');
    expect(ctx.organizationId).toBe('org-456');
    expect(ctx.role).toBe('ORGANIZER');
    expect(ctx.correlationId).toBe('corr-789');
  });

  it('should create CurrentUser with authentication status', () => {
    const authenticatedCtx = createRequestContext({
      userId: 'user-123',
      organizationId: 'org-456',
      role: 'LEARNER',
      correlationId: 'corr-1',
    });

    const user = createCurrentUser(authenticatedCtx);
    expect(user.isAuthenticated).toBe(true);
    expect(user.userId).toBe('user-123');
    expect(user.role).toBe('LEARNER');
    expect(user.organizationId).toBe('org-456');

    const unauthenticatedCtx = createRequestContext({
      correlationId: 'corr-2',
    });
    const unauthenticatedUser = createCurrentUser(unauthenticatedCtx);
    expect(unauthenticatedUser.isAuthenticated).toBe(false);
    expect(unauthenticatedUser.userId).toBeUndefined();
    expect(unauthenticatedUser.role).toBeUndefined();
  });

  it('should create OrganizationContext with tenant presence flag', () => {
    const ctxWithOrg = createRequestContext({
      organizationId: 'org-456',
      correlationId: 'corr-1',
    });
    const orgContext = createOrganizationContext(ctxWithOrg);
    expect(orgContext.hasOrganization).toBe(true);
    expect(orgContext.organizationId).toBe('org-456');

    const ctxWithoutOrg = createRequestContext({
      correlationId: 'corr-2',
    });
    const noOrgContext = createOrganizationContext(ctxWithoutOrg);
    expect(noOrgContext.hasOrganization).toBe(false);
    expect(noOrgContext.organizationId).toBeUndefined();
  });

  it('should create CorrelationContext', () => {
    const ctx = createRequestContext({
      correlationId: 'corr-abc-123',
    });
    const correlation = createCorrelationContext(ctx);
    expect(correlation.correlationId).toBe('corr-abc-123');
  });
});
