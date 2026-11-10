import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { Logger } from '@nestjs/common';
import {
  TenantOrganizationNotFoundError,
  TenantUnavailableError,
  type OrganizationAccess,
} from './tenant.client';

export class TenantAccessHttp {
  private readonly logger = new Logger(TenantAccessHttp.name);

  constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
    private readonly timeoutMs = 3000,
  ) {}

  static fromConfig(
    get: (key: string) => string | undefined,
  ): TenantAccessHttp {
    const raw = get('TENANT_SERVICE_URL')?.trim();
    if (!raw)
      throw new Error('Missing TENANT_SERVICE_URL for organization access.');
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error('Invalid TENANT_SERVICE_URL.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'TENANT_SERVICE_URL must be HTTP(S) without credentials, query or fragment.',
      );
    }
    const key = get('INTERNAL_SERVICE_KEY')?.trim();
    if (!key)
      throw new Error('Missing INTERNAL_SERVICE_KEY for organization access.');
    const timeout = Number(get('TENANT_SERVICE_TIMEOUT_MS') ?? 3000);
    if (!Number.isInteger(timeout) || timeout < 1)
      throw new Error('TENANT_SERVICE_TIMEOUT_MS must be a positive integer.');
    return new TenantAccessHttp(raw.replace(/\/+$/, ''), key, timeout);
  }

  async getOrganizationAccess(user: CurrentUser): Promise<OrganizationAccess> {
    const organizationId = user.organizationId;
    if (!organizationId)
      throw new TenantUnavailableError(
        'Missing organization ID for tenant access.',
      );
    let response: Response;
    let body: unknown;
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/internal/organizations/${encodeURIComponent(organizationId)}/access`,
        {
          method: 'GET',
          headers: {
            [HEADER_NAMES.INTERNAL_KEY]: this.internalKey,
            [HEADER_NAMES.ORGANIZATION_ID]: organizationId,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
      // Keep the deadline active while consuming the response body too.
      body = await response.json();
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        ['TimeoutError', 'AbortError'].includes(error.name);
      throw new TenantUnavailableError(
        timedOut
          ? `Tenant access timed out after ${this.timeoutMs} ms.`
          : 'Tenant access network or JSON error.',
      );
    }
    if (!response.ok) {
      const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
      if (response.status === 404 && code === 'ORGANIZATION_NOT_FOUND') {
        this.logger.error(
          `Tenant organization not found: organizationId=${organizationId}`,
        );
        throw new TenantOrganizationNotFoundError();
      }
      throw new TenantUnavailableError(
        `Tenant access returned HTTP ${response.status}.`,
      );
    }
    const data = (body as { data?: Record<string, unknown> } | null)?.data;
    if (
      !data ||
      typeof data !== 'object' ||
      typeof data.organizationId !== 'string' ||
      data.organizationId.toLowerCase() !== organizationId.toLowerCase() ||
      typeof data.organizationStatus !== 'string' ||
      !['PendingPayment', 'Active', 'Suspended', 'Cancelled'].includes(
        data.organizationStatus,
      ) ||
      typeof data.subscriptionStatus !== 'string' ||
      !['Active', 'Grace', 'Suspended', 'Ended'].includes(
        data.subscriptionStatus,
      ) ||
      !(
        data.readOnlyEndsAt === null ||
        (typeof data.readOnlyEndsAt === 'string' &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
            data.readOnlyEndsAt,
          ) &&
          Number.isFinite(Date.parse(data.readOnlyEndsAt)))
      ) ||
      typeof data.timezone !== 'string' ||
      !this.validTimezone(data.timezone)
    )
      throw new TenantUnavailableError(
        'Tenant access violates the data contract.',
      );
    return {
      organizationStatus: data.organizationStatus,
      subscriptionStatus: data.subscriptionStatus,
      readOnlyEndsAt:
        data.readOnlyEndsAt === null ? null : new Date(data.readOnlyEndsAt),
      timezone: data.timezone,
    };
  }

  private validTimezone(timezone: string): boolean {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
