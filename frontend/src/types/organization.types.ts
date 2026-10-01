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
