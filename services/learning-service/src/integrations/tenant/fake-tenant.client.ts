import type { OrganizationAccess, TenantClient } from './tenant.client';

/**
 * Tenant client giả cho dev khi tenant-service chưa có REST (D7, D14):
 * mọi tổ chức Active, không có hạn chỉ đọc, múi giờ lấy từ cấu hình.
 */
export class FakeTenantClient implements TenantClient {
  constructor(private readonly timezone: string) {}

  getOrganizationAccess(): Promise<OrganizationAccess> {
    return Promise.resolve({
      subscriptionStatus: 'Active',
      readOnlyEndsAt: null,
      timezone: this.timezone,
    });
  }
}
