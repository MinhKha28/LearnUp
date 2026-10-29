import type { OrganizationAccess, TenantClient } from './tenant.client';

/**
 * Access client giả cho dev khi tenant-service chưa có REST trạng thái truy cập (D7, D14):
 * mọi tổ chức Active, không có hạn chỉ đọc, múi giờ lấy từ cấu hình.
 */
export class FakeTenantClient implements Pick<
  TenantClient,
  'getOrganizationAccess'
> {
  constructor(private readonly timezone: string) {}

  getOrganizationAccess(): Promise<OrganizationAccess> {
    return Promise.resolve({
      organizationStatus: 'Active',
      subscriptionStatus: 'Active',
      readOnlyEndsAt: null,
      timezone: this.timezone,
    });
  }
}
