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

// UC12.2 - số chỗ theo Subscription hiện hành (GET /api/v1/users/instructors/seats)
export interface ISeatUsage {
  used: number;
  max: number;
  remaining: number;
  subscriptionStatus: "Active" | "Grace" | "Suspended" | null;
  canCreate: boolean;
}
