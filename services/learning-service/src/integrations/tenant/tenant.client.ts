import type { CurrentUser } from '@learnup/ts-common';

/** Trạng thái truy cập của tổ chức (BR-15, BR-17, BR-44). */
export interface OrganizationAccess {
  subscriptionStatus: string;
  readOnlyEndsAt: Date | null;
  timezone: string;
}

export interface TenantClient {
  getOrganizationAccess(user: CurrentUser): Promise<OrganizationAccess>;
}

/** Token inject TenantClient; bản cài đặt chọn theo TENANT_CLIENT_MODE. */
export const TENANT_CLIENT = Symbol('TENANT_CLIENT');
