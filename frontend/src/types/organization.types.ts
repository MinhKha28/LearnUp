import type { AssignmentStatus } from "@/types/assignment.types";

export interface IOrganization {
  id: string;
  name: string;
  timezone: string;
}

// UC01 - dữ liệu một gói do GET /api/v1/subscription-plans trả về
export interface IOrganizationProfile {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string | null;
  logoUrl: string | null;
  timezone: string;
  status: string;
  updatedAt: string;
}

export type IUpdateOrganizationReq = Partial<
  Pick<
    IOrganizationProfile,
    "name" | "taxCode" | "address" | "contactPhone" | "contactEmail" | "timezone"
  >
>;

export interface ISubscriptionPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  maxLearners: number;
  maxInstructors: number;
  maxCourseChains: number;
  maxStorageBytes: number;
}

export interface IAdminPlan extends ISubscriptionPlan {
  isOffered: boolean;
  organizationCount: number;
  createdAt: string;
}

export type ICreatePlanReq = Omit<ISubscriptionPlan, "id">;

// UC44 - Admin xem danh sách Organization (khớp IAdminOrganizationListItem ở tenant-service)
export type AdminOrganizationStatus =
  | "PendingPayment"
  | "Active"
  | "Suspended"
  | "Cancelled";
export type AdminSubscriptionStatus = "Active" | "Grace" | "Suspended";

export interface IAdminOrganizationListItem {
  id: string;
  name: string;
  contactEmail: string | null;
  // Trạng thái hiệu lực: PendingPayment quá hạn thanh toán đã được tính là Cancelled (BR-8)
  status: AdminOrganizationStatus;
  plan: { id: string; name: string } | null;
  // Độc lập với trạng thái Organization (BR-60); null khi chưa có hoặc đã kết thúc
  subscription: {
    status: AdminSubscriptionStatus;
    startsAt: string;
    expiresAt: string;
    graceEndsAt: string | null;
  } | null;
  paymentDueAt: string | null;
  createdAt: string;
}

// UC44.1 - một giới hạn của Subscription; used = null khi không đếm được (course-service lỗi)
export interface IAdminUsageItem {
  used: number | null;
  limit: number;
  percent: number | null;
  warning: boolean;
}

// UC44.1 - Admin xem chi tiết Organization (khớp IAdminOrganizationDetail ở tenant-service)
export interface IAdminOrganizationDetail {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string | null;
  logoUrl: string | null;
  timezone: string;
  status: AdminOrganizationStatus;
  createdAt: string;
  // BR-50: Organizer đang chờ nhận lời mời cũng là Organizer hiện tại
  organizer: {
    id: string;
    fullName: string;
    email: string;
    status: "Pending" | "Active";
    activatedAt: string | null;
    invitation: { sentAt: string; expiresAt: string; expired: boolean } | null;
  } | null;
  plan: { id: string; name: string } | null;
  subscription: {
    plan: { id: string; name: string };
    status: AdminSubscriptionStatus;
    startsAt: string;
    expiresAt: string;
    graceEndsAt: string | null;
    readOnlyEndsAt: string | null;
    daysRemaining: number;
  } | null;
  paymentDueAt: string | null;
  usageWarningThresholdPercent: number;
  // null: chưa có Subscription hiện hành
  usage: {
    courseUsageAvailable: boolean;
    learners: IAdminUsageItem;
    instructors: IAdminUsageItem;
    courses: IAdminUsageItem;
    storageBytes: IAdminUsageItem;
  } | null;
  // BR-56, BR-58: mới nhất trước; endedAt = null là đang khóa, có endedAt là đã gỡ
  suspensions: { id: string; startedAt: string; endedAt: string | null; reason: string }[];
  // BR-54: chỉ cảnh báo
  duplicateTaxCode: {
    count: number;
    organizations: { id: string; name: string; status: AdminOrganizationStatus }[];
  };
}

export interface IAdminOrganizationListQuery {
  page: number;
  pageSize: number;
  includeCancelled: boolean;
}

// UC02 - body gửi lên POST /api/v1/registrations (khớp CreateRegistrationDto ở backend)
export interface ICreateRegistrationReq {
  planId: string;
  organization: {
    name: string;
    taxCode: string;
    address: string;
    contactPhone: string;
  };
  organizer: {
    fullName: string;
    email: string;
    password: string;
  };
}

// Phản hồi trung tính (BR-276): giống nhau dù email mới, đã có đăng ký chờ hay đã chạm giới hạn gửi lại
export interface ICreateRegistrationRes {
  email: string;
  otpTtlMinutes: number;
  message: string;
}

// Lỗi tenant-service: { code, message } (lỗi nghiệp vụ) hoặc { message: [...] } (lỗi DTO)
export interface IApiError {
  code?: string;
  message: string | string[];
}

// UC02.1 - tóm tắt đăng ký do GET /api/v1/registrations/:token trả về
export interface IRegistrationSummary {
  registrationId: string;
  status: "PendingPayment" | "Paid";
  expiresAt: string;
  organizationName: string;
  organizerEmail: string;
  plan: Omit<ISubscriptionPlan, "id">; // giá và giới hạn đã chốt lúc đăng ký (BR-275)
}

// UC02.1 - body gửi lên POST /api/v1/registrations/payments
export interface IPayRegistrationReq {
  token: string;
  simulateFailure?: boolean;
}

// UC02.1 - kết quả thanh toán
export interface IPaymentResult {
  paymentId: string;
  paymentStatus: "Succeeded" | "Failed";
  failureReason?: string | null;
  subscription?: { id: string; startsAt: string; expiresAt: string };
  organizerEmail?: string;
}

// UC03 - body gửi lên POST /api/v1/registrations/verify-email (BR-337: mã 6 số)
export interface IVerifyEmailOtpReq {
  email: string;
  otp: string;
}

// UC03 - nhập mã đúng: backend trả token mới để thanh toán ngay (UC02.1)
export interface IVerifyEmailOtpRes {
  paymentToken: string;
  registrationExpiresAt: string;
}

// UC04 - thông tin lời mời (GET /api/v1/invitations/:token)
export interface IInvitationInfo {
  email: string;
  fullName: string;
  role: "Instructor" | "Learner";
  organizationName: string;
}

// UC04 - body POST /api/v1/invitations/accept
export interface IAcceptInvitationReq {
  token: string;
  password: string;
}

// UC04 - kết quả kích hoạt
export interface IAcceptInvitationResult {
  email: string;
  role: "Instructor" | "Learner";
}

// Trạng thái tài khoản (users.status)
export type AccountStatus = "Pending" | "Active" | "Deactivated";

// Query danh sách tài khoản trong tổ chức (UC12, UC13); keyword, status cho UC12.4
export interface IAccountListQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: AccountStatus;
}

// Một dòng tài khoản trong danh sách (dùng chung Instructor / Learner)
export interface IAccountListItem {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  status: AccountStatus;
  activatedAt: string | null;
  createdAt: string;
  invitationExpired: boolean;
}

// UC12 - dòng Instructor do GET /api/v1/users/instructors trả về
export interface IInstructorListItem extends IAccountListItem {
  managedCourseCount: number | null; // null: không hỏi được course-service
}

// UC12.1 - trạng thái phiên bản Course (course-service); bản đại diện của chuỗi không bao giờ Archived
export type CourseStatus =
  | "Draft"
  | "Submitted"
  | "Published"
  | "Rejected"
  | "Archived"
  | "Disabled";

// UC12.1 - một chuỗi Course Instructor phụ trách, đại diện bằng phiên bản hiện hành (BR-287, BR-336)
export interface IManagedCourseChain {
  chainId: string;
  courseId: string;
  name: string;
  versionNumber: number;
  status: CourseStatus;
  courseType: "Public" | "Private";
  approvedAt: string | null; // null: chuỗi chưa từng được duyệt
}

// UC12.1 - chi tiết Instructor do GET /api/v1/users/instructors/:id trả về
export interface IInstructorDetail extends IAccountListItem {
  avatarUrl: string | null;
  // Chỉ có khi Pending và còn lời mời đang mở (có thể đã quá hạn)
  invitation: { sentAt: string; expiresAt: string } | null;
  courses: IManagedCourseChain[] | null; // null: không hỏi được course-service
  violations: null; // GĐ2: kiểm duyệt nội dung
}

// UC13 - dòng Learner do GET /api/v1/users/learners trả về (null: không hỏi được learning-service)
export interface ILearnerListItem extends IAccountListItem {
  activeCourseCount: number | null; // Enrollment đang dở (kể cả quá hạn)
  overdueCourseCount: number | null; // Enrollment Required đang quá hạn
}

// UC13.1 - một Enrollment của Learner (learning-service), không bao giờ Withdrawn
export interface ILearnerEnrollment {
  enrollmentId: string;
  courseId: string;
  course: { name: string; versionNumber: number } | null; // null: course-service không trả phiên bản này
  enrollmentType: "Required" | "Optional";
  status: AssignmentStatus; // trạng thái hiển thị, Overdue đã tính lúc đọc
  enrolledAt: string;
  assignedAt: string | null;
  dueAt: string | null; // Optional luôn null (BR-129)
  completedAt: string | null;
  requiredMaterials: { completed: number; total: number }; // chỉ học liệu bắt buộc
}

// UC13.1 - chi tiết Learner do GET /api/v1/users/learners/:id trả về
export interface ILearnerDetail extends IAccountListItem {
  avatarUrl: string | null;
  // Chỉ có khi Pending và còn lời mời đang mở (có thể đã quá hạn)
  invitation: { sentAt: string; expiresAt: string } | null;
  enrollments: ILearnerEnrollment[] | null; // null: không hỏi được learning-service
}

// UC12.2 - body tạo tài khoản trong tổ chức (khớp CreateAccountDto; sau này UC13.2 dùng lại)
export interface ICreateAccountReq {
  fullName: string;
  email: string;
  department?: string | null;
}

// UC12.3 - body PATCH /api/v1/users/instructors/:id (khớp UpdateAccountDto): chỉ gửi trường đã đổi
export interface IUpdateAccountReq {
  fullName?: string;
  email?: string;
  department?: string | null;
}

// UC12.3 - kết quả sửa; invitationResent: đổi email của tài khoản Pending -> đã gửi lời mời mới
export interface IUpdateAccountResult extends IAccountListItem {
  invitationResent: boolean;
}

export interface IReinvitationResult {
  id: string;
  status: AccountStatus;
  invitationExpired: false;
  invitation: { sentAt: string; expiresAt: string };
}

// UC12.5 - Instructor tiếp nhận hợp lệ (cùng tổ chức, đã kích hoạt, Active, khác người bị vô hiệu hóa)
export interface IStatusChangeReceiver {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
}

export type DeactivationBlockReason =
  | "ACCOUNT_NOT_ACTIVATED"
  | "ALREADY_DEACTIVATED"
  | "NO_VALID_RECEIVER"
  | "COURSE_SERVICE_UNAVAILABLE";

// UC12.5 - GET /api/v1/users/instructors/:id/status-change
export interface IInstructorStatusChange {
  id: string;
  status: AccountStatus;
  activated: boolean;
  canDeactivate: boolean;
  blockReason: DeactivationBlockReason | null;
  courses: IManagedCourseChain[] | null; // null: không hỏi được course-service
  receivers: IStatusChangeReceiver[];
}

// UC12.5 - PATCH /api/v1/users/instructors/:id/status
export interface IChangeAccountStatusReq {
  action: "DEACTIVATE" | "REACTIVATE";
  receiverInstructorId?: string;
  reason?: string;
}

export interface IInstructorStatusResult {
  id: string;
  status: AccountStatus;
  changed: boolean; // false: đã ở trạng thái đích (bấm lặp)
  transferredCourses: IManagedCourseChain[];
  receiver: { id: string; fullName: string } | null;
}

// UC12.6 - GET /api/v1/users/instructors/:id/deletion (mọi trạng thái đều xóa được, BR-46)
export interface IInstructorDeletion {
  id: string;
  status: AccountStatus;
  activated: boolean;
  canDelete: boolean;
  blockReason: "NO_VALID_RECEIVER" | "COURSE_SERVICE_UNAVAILABLE" | null;
  courses: IManagedCourseChain[] | null; // null: không hỏi được course-service
  receivers: IStatusChangeReceiver[];
}

// UC12.6 - DELETE /api/v1/users/instructors/:id (body JSON)
export interface IDeleteAccountReq {
  receiverInstructorId?: string;
  reason?: string;
}

export interface IInstructorDeletionResult {
  id: string;
  changed: boolean; // false: đã bị xóa từ trước (bấm lặp)
  transferredCourses: IManagedCourseChain[];
  receiver: { id: string; fullName: string } | null;
  seats: ISeatUsage; // số chỗ sau khi xóa (BR-31, BR-46)
}

// UC13.5 - PATCH /api/v1/users/learners/:id/status (Learner không có chuyển quyền nên không gửi receiverInstructorId)
export type IChangeLearnerStatusReq = Omit<
  IChangeAccountStatusReq,
  "receiverInstructorId"
>;

export interface ILearnerStatusResult {
  id: string;
  status: AccountStatus;
  changed: boolean; // false: đã ở trạng thái đích (bấm lặp)
}

// UC13.6 - DELETE /api/v1/users/learners/:id (body JSON; Learner không có chuyển quyền)
export type IDeleteLearnerReq = Omit<IDeleteAccountReq, "receiverInstructorId">;

export interface ILearnerDeletionResult {
  id: string;
  changed: boolean; // false: đã bị xóa từ trước (bấm lặp)
  seats: ISeatUsage; // số chỗ Learner sau khi xóa (BR-31, BR-46)
}

// UC12.2 - số chỗ theo Subscription hiện hành (GET /api/v1/users/instructors/seats)
export interface ISeatUsage {
  used: number;
  max: number;
  remaining: number;
  subscriptionStatus: "Active" | "Grace" | "Suspended" | null;
  canCreate: boolean;
}

// UC12.8 - Import Instructor hàng loạt (dùng lại cho UC13.8). Khớp tenant-service member-imports.
export type ImportField = "fullName" | "email" | "department" | "role";

export type ImportRowErrorCode =
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_EMAIL"
  | "DUPLICATE_EMAIL_IN_FILE"
  | "EMAIL_ALREADY_USED"
  | "INVALID_ROLE"
  | "INVALID_VALUE";

export interface IImportRowError {
  field: ImportField;
  code: ImportRowErrorCode;
  message: string;
  relatedRows?: number[];
}

export interface IValidImportRow {
  rowNumber: number;
  fullName: string;
  email: string;
  department: string | null;
}

export interface IInvalidImportRow {
  rowNumber: number;
  values: Record<ImportField, string>;
  errors: IImportRowError[];
}

export interface IMemberImportPreview {
  role: string;
  totalRows: number;
  validRows: IValidImportRow[];
  invalidRows: IInvalidImportRow[];
  seats: ISeatUsage;
  exceedsSeats: boolean;
  canConfirm: boolean;
  previewDigest: string;
}

export interface IImportedAccount {
  id: string;
  rowNumber: number;
  fullName: string;
  email: string;
  department: string | null;
  status: AccountStatus;
}

export interface IMemberImportResult {
  role: string;
  createdCount: number;
  skippedCount: number;
  accounts: IImportedAccount[];
}

// Lỗi của API import: ngoài code/message còn có trường riêng (IMPORT_CHANGED kèm preview mới, ...)
export interface IImportApiError extends IApiError {
  preview?: IMemberImportPreview;
  validCount?: number;
  remaining?: number;
  maxRows?: number;
  maxSizeBytes?: number;
  missingColumns?: string[];
}
