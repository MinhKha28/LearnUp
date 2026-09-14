import { UserRole } from '../auth/role.js';

/**
 * Framework-neutral representation of the incoming request context.
 */
export interface RequestContext {
  userId?: string;
  organizationId?: string;
  role?: UserRole;
  correlationId: string;
}

/**
 * Representation of the currently authenticated user in request scope.
 */
export interface CurrentUser {
  userId?: string;
  role?: UserRole;
  organizationId?: string;
  isAuthenticated: boolean;
}

/**
 * Representation of multi-tenant organization context.
 */
export interface OrganizationContext {
  organizationId?: string;
  hasOrganization: boolean;
}

/**
 * Representation of the request correlation ID for tracing.
 */
export interface CorrelationContext {
  correlationId: string;
}

/**
 * Factory creating an immutable RequestContext object.
 */
export function createRequestContext(params: {
  userId?: string | null;
  organizationId?: string | null;
  role?: UserRole | null;
  correlationId: string;
}): RequestContext {
  return {
    userId: params.userId?.trim() || undefined,
    organizationId: params.organizationId?.trim() || undefined,
    role: params.role || undefined,
    correlationId: params.correlationId.trim(),
  };
}

/**
 * Extract CurrentUser helper object from RequestContext.
 */
export function createCurrentUser(context?: RequestContext): CurrentUser {
  const userId = context?.userId;
  return {
    userId,
    role: context?.role,
    organizationId: context?.organizationId,
    isAuthenticated: Boolean(userId && userId.trim().length > 0),
  };
}

/**
 * Extract OrganizationContext helper object from RequestContext.
 */
export function createOrganizationContext(context?: RequestContext): OrganizationContext {
  const organizationId = context?.organizationId;
  return {
    organizationId,
    hasOrganization: Boolean(organizationId && organizationId.trim().length > 0),
  };
}

/**
 * Extract CorrelationContext helper object from RequestContext.
 */
export function createCorrelationContext(context: RequestContext): CorrelationContext {
  return {
    correlationId: context.correlationId,
  };
}
