import { HEADER_NAMES, type CurrentUser } from '@learnup/ts-common';
import { isUUID } from 'class-validator';
import { TenantUnavailableError, type LookupLearner } from './tenant.client';

export class TenantLookupHttp {
  constructor(
    private readonly baseUrl: string,
    private readonly internalKey: string,
    private readonly timeoutMs = 3000,
  ) {}

  static fromConfig(
    get: (key: string) => string | undefined,
  ): TenantLookupHttp {
    const raw = get('TENANT_SERVICE_URL')?.trim();
    if (!raw) throw new Error('Thiếu TENANT_SERVICE_URL để lookup Learner.');
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error('TENANT_SERVICE_URL không hợp lệ.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'TENANT_SERVICE_URL phải là URL HTTP(S) không chứa thông tin đăng nhập, query hoặc fragment.',
      );
    }
    const key = get('INTERNAL_SERVICE_KEY')?.trim();
    if (!key) throw new Error('Thiếu INTERNAL_SERVICE_KEY để lookup Learner.');
    const timeout = Number(get('TENANT_SERVICE_TIMEOUT_MS') ?? 3000);
    if (!Number.isInteger(timeout) || timeout < 1)
      throw new Error('TENANT_SERVICE_TIMEOUT_MS phải là số nguyên dương.');
    return new TenantLookupHttp(raw.replace(/\/+$/, ''), key, timeout);
  }

  async lookupLearners(
    user: CurrentUser,
    learnerIds: string[],
  ): Promise<LookupLearner[]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/internal/users/lookup`, {
        method: 'POST',
        headers: {
          [HEADER_NAMES.INTERNAL_KEY]: this.internalKey,
          [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId!,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: user.organizationId,
          userIds: learnerIds,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        ['TimeoutError', 'AbortError'].includes(error.name);
      throw new TenantUnavailableError(
        timedOut
          ? `Tenant lookup quá thời gian ${this.timeoutMs} ms.`
          : 'Tenant lookup lỗi mạng.',
      );
    }
    if (!response.ok)
      throw new TenantUnavailableError(
        `Tenant lookup trả HTTP ${response.status}.`,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new TenantUnavailableError('Tenant lookup trả JSON không hợp lệ.');
    }
    const items = (body as { data?: { items?: unknown } } | null)?.data?.items;
    const requested = new Set(learnerIds);
    const seen = new Set<string>();
    if (
      !Array.isArray(items) ||
      !items.every((item: unknown) => {
        if (!item || typeof item !== 'object') return false;
        const r = item as Record<string, unknown>;
        if (
          typeof r.userId !== 'string' ||
          !isUUID(r.userId) ||
          !requested.has(r.userId) ||
          seen.has(r.userId)
        )
          return false;
        seen.add(r.userId);
        return (
          ['Admin', 'Organizer', 'Instructor', 'Learner'].includes(
            String(r.role),
          ) &&
          ['Pending', 'Active', 'Deactivated'].includes(String(r.status)) &&
          (r.deletedAt === null ||
            (typeof r.deletedAt === 'string' &&
              Number.isFinite(Date.parse(r.deletedAt)))) &&
          (r.activatedAt === null ||
            (typeof r.activatedAt === 'string' &&
              Number.isFinite(Date.parse(r.activatedAt)))) &&
          typeof r.fullName === 'string' &&
          typeof r.email === 'string'
        );
      })
    )
      throw new TenantUnavailableError(
        'Tenant lookup sai hợp đồng data.items.',
      );
    return items as LookupLearner[];
  }
}
