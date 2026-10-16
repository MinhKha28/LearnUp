import type { CurrentUser } from '@learnup/ts-common';

/** Trạng thái truy cập của tổ chức (BR-15, BR-17, BR-44). */
export interface OrganizationAccess {
  subscriptionStatus: string;
  readOnlyEndsAt: Date | null;
  timezone: string;
}

export interface TenantClient {
  getOrganizationAccess(user: CurrentUser): Promise<OrganizationAccess>;
  lookupLearners(
    user: CurrentUser,
    learnerIds: string[],
  ): Promise<LookupLearner[]>;
}

export interface LookupLearner {
  userId: string;
  role: string;
  status: string;
  activatedAt: string | null;
  deletedAt: string | null;
  fullName: string;
  email: string;
}

/** Token inject TenantClient; bản cài đặt chọn theo TENANT_CLIENT_MODE. */
export const TENANT_CLIENT = Symbol('TENANT_CLIENT');

/** tenant-service không trả lời được (lỗi mạng, quá thời gian, 5xx); lớp trên trả 503. */
export class TenantUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
