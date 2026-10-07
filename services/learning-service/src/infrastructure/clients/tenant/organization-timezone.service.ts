import type { CurrentUser } from '@learnup/ts-common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TENANT_CLIENT, type TenantClient } from './tenant.client';

const TTL_MS = 5 * 60 * 1000;

/**
 * Múi giờ tổ chức để hiển thị hạn (D24, BR-44): cache trong bộ nhớ theo organizationId, TTL 5 phút.
 * Tenant lỗi thì trả null và ghi log, không cache lần lỗi, không làm hỏng response của trang gọi.
 */
@Injectable()
export class OrganizationTimezoneService {
  private readonly logger = new Logger(OrganizationTimezoneService.name);
  private readonly cache = new Map<
    string,
    { timezone: string; expiresAt: number }
  >();

  constructor(@Inject(TENANT_CLIENT) private readonly tenant: TenantClient) {}

  async getTimezone(user: CurrentUser): Promise<string | null> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      return null;
    }

    const cached = this.cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.timezone;
    }

    try {
      const { timezone } = await this.tenant.getOrganizationAccess(user);
      this.cache.set(organizationId, {
        timezone,
        expiresAt: Date.now() + TTL_MS,
      });
      return timezone;
    } catch (error) {
      this.logger.error(
        `Không lấy được múi giờ của tổ chức ${organizationId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
