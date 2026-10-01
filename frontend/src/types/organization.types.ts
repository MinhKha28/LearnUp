export interface IOrganization {
  id: string;
  name: string;
  timezone: string;
}

// UC01 - dữ liệu một gói do GET /api/v1/subscription-plans trả về
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

// UC02 - backend trả 1 trong 2 dạng, phân biệt bằng trường "resent"
export type ICreateRegistrationRes =
  | {
      resent: false;
      registrationId: string;
      paymentToken: string;
      expiresAt: string;
    }
  | { resent: true; message: string };

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

// Trạng thái tài khoản (users.status)
export type AccountStatus = "Pending" | "Active" | "Deactivated";

// Query danh sách tài khoản trong tổ chức (UC12, sau này UC13)
export interface IAccountListQuery {
  page: number;
  pageSize: number;
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

// UC13 - dòng Learner do GET /api/v1/users/learners trả về (null: không hỏi được learning-service)
export interface ILearnerListItem extends IAccountListItem {
  activeCourseCount: number | null; // Enrollment đang dở (kể cả quá hạn)
  overdueCourseCount: number | null; // Enrollment Required đang quá hạn
}

// UC12.2 - body tạo tài khoản trong tổ chức (khớp CreateAccountDto; sau này UC13.2 dùng lại)
export interface ICreateAccountReq {
  fullName: string;
  email: string;
  department?: string | null;
}

// UC12.2 - số chỗ theo Subscription hiện hành (GET /api/v1/users/instructors/seats)
export interface ISeatUsage {
  used: number;
  max: number;
  remaining: number;
  subscriptionStatus: "Active" | "Grace" | "Suspended" | null;
  canCreate: boolean;
}
