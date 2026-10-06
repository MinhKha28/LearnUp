// Giá trị trạng thái lưu dạng PascalCase (quy ước tenant_db mục 1).
export const OrganizationStatus = {
  PendingPayment: 'PendingPayment',
  Active: 'Active',
  Suspended: 'Suspended',
  Cancelled: 'Cancelled',
} as const;

export const UserRoleValue = {
  Admin: 'Admin',
  Organizer: 'Organizer',
  Instructor: 'Instructor',
  Learner: 'Learner',
} as const;

export const UserStatus = {
  Pending: 'Pending',
  Active: 'Active',
  Deactivated: 'Deactivated',
} as const;

export const RegistrationStatus = {
  PendingPayment: 'PendingPayment',
  Paid: 'Paid',
  Expired: 'Expired',
} as const;

export const SubscriptionStatus = {
  Scheduled: 'Scheduled',
  Active: 'Active',
  Grace: 'Grace',
  Suspended: 'Suspended',
  Ended: 'Ended',
} as const;

export const PaymentStatus = {
  Pending: 'Pending',
  Succeeded: 'Succeeded',
  Failed: 'Failed',
} as const;

export const PaymentKind = {
  Registration: 'Registration',
  Renewal: 'Renewal',
  Upgrade: 'Upgrade',
} as const;

export const TokenPurpose = {
  Invitation: 'Invitation',
} as const;

export type TokenPurposeValue =
  (typeof TokenPurpose)[keyof typeof TokenPurpose];

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
