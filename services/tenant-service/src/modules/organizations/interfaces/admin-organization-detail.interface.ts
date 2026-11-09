import type { IUsageItem } from '../../subscriptions/interfaces/subscription-overview.interface';
import type {
  IAdminOrganizationPlan,
  IAdminOrganizationSubscription,
} from './admin-organization-list-item.interface';

/** UC44.1 - BR-50: Organizer hiện tại; Organizer đang chờ nhận lời mời cũng là Organizer hiện tại. */
export interface IAdminOrganizationOrganizer {
  id: string;
  fullName: string;
  email: string;
  status: string; // Pending | Active
  activatedAt: Date | null;
  // Lời mời đang mở (chưa dùng, chưa thu hồi), có thể đã quá hạn; null khi không có lời mời
  // (Organizer đã kích hoạt, hoặc Organizer lúc đăng ký đang chờ thanh toán - BR-6).
  invitation: { sentAt: Date; expiresAt: Date; expired: boolean } | null;
}

/** UC44.1: Subscription hiện hành, thêm thời hạn chỉ-xem và số ngày còn lại so với UC44. */
export interface IAdminOrganizationDetailSubscription extends IAdminOrganizationSubscription {
  plan: IAdminOrganizationPlan;
  readOnlyEndsAt: Date | null;
  daysRemaining: number;
}

/** UC44.1 - BR-56: một lượt tạm khóa; endedAt = null là đang khóa. */
export interface IAdminOrganizationSuspension {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  reason: string;
}

/** UC44.1 - BR-54: Organization khác dùng cùng mã số thuế. Chỉ cảnh báo, không chặn. */
export interface IAdminDuplicateTaxCode {
  count: number; // tổng số Organization khác trùng mã số thuế
  organizations: { id: string; name: string; status: string }[]; // tối đa 10, mới nhất trước
}

/** UC44.1 - BR-1: mức sử dụng trên 4 giới hạn của Subscription hiện hành. */
export interface IAdminOrganizationUsage {
  // false: không hỏi được course-service -> courses.used và storageBytes.used = null.
  courseUsageAvailable: boolean;
  learners: IUsageItem;
  instructors: IUsageItem;
  courses: IUsageItem; // đếm theo chuỗi phiên bản (course-service)
  storageBytes: IUsageItem; // BR-188 (course-service tính)
}

/** UC44.1: chi tiết Organization cho Admin nền tảng. */
export interface IAdminOrganizationDetail {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string | null;
  logoUrl: string | null;
  timezone: string;
  // Trạng thái hiệu lực như UC44: PendingPayment quá hạn thanh toán tính là Cancelled (BR-8).
  status: string; // PendingPayment | Active | Suspended | Cancelled
  createdAt: Date;
  organizer: IAdminOrganizationOrganizer | null;
  // Gói đang dùng; khi chưa có Subscription là gói đã đăng ký (như UC44).
  plan: IAdminOrganizationPlan | null;
  subscription: IAdminOrganizationDetailSubscription | null;
  paymentDueAt: Date | null; // chỉ có khi status = PendingPayment
  usageWarningThresholdPercent: number;
  // null khi chưa có Subscription hiện hành (không có giới hạn để so).
  usage: IAdminOrganizationUsage | null;
  suspensions: IAdminOrganizationSuspension[];
  duplicateTaxCode: IAdminDuplicateTaxCode;
}
