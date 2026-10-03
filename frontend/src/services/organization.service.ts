import type {
  IAccountListItem,
  IAccountListQuery,
  ICreateAccountReq,
  ICreateRegistrationReq,
  ICreateRegistrationRes,
  IInstructorListItem,
  ILearnerListItem,
  IPaymentResult,
  IPayRegistrationReq,
  IRegistrationSummary,
  ISeatUsage,
  ISubscriptionPlan,
  IVerifyEmailResult,
  IAcceptInvitationReq,
  IAcceptInvitationResult,
  IInvitationInfo
} from "@/types/organization.types";
import axios from "@/services/axios.customize";

// UC01 - Xem Subscription Plan (Guest, không cần đăng nhập)
export const getSubscriptionPlansAPI = () =>
  axios.get<IBackendRes<ISubscriptionPlan[]>>("/api/v1/subscription-plans");

// UC02 - Đăng ký Organization (Guest)
export const createRegistrationAPI = (body: ICreateRegistrationReq) =>
  axios.post<IBackendRes<ICreateRegistrationRes>>(
    "/api/v1/registrations",
    body,
  );

// UC02.1 - Tóm tắt đăng ký theo liên kết thanh toán
export const getRegistrationByTokenAPI = (token: string) =>
  axios.get<IBackendRes<IRegistrationSummary>>(
    `/api/v1/registrations/${encodeURIComponent(token)}`,
  );

// UC02.1 - Thực hiện thanh toán qua Mock Payment Service
export const payRegistrationAPI = (body: IPayRegistrationReq) =>
  axios.post<IBackendRes<IPaymentResult>>(
    "/api/v1/registrations/payments",
    body,
  );

// UC03 - Xác thực email Organizer bằng liên kết trong email thứ hai
export const verifyEmailAPI = (token: string) =>
  axios.post<IBackendRes<IVerifyEmailResult>>(
    "/api/v1/registrations/verify-email",
    { token },
  );

// UC12 - Xem danh sách Instructor (Organizer; tổ chức lấy từ danh tính người gọi)
export const getInstructorsAPI = (query: IAccountListQuery) =>
  axios.get<IBackendRes<IPageResponse<IInstructorListItem>>>(
    "/api/v1/users/instructors",
    { params: query },
  );

// UC12.2 - số chỗ Instructor còn lại (Organizer)
export const getInstructorSeatsAPI = () =>
  axios.get<IBackendRes<ISeatUsage>>("/api/v1/users/instructors/seats");

// UC12.2 - Thêm Instructor (Organizer; backend gửi lời mời qua email)
export const createInstructorAPI = (body: ICreateAccountReq) =>
  axios.post<IBackendRes<IAccountListItem>>("/api/v1/users/instructors", body);

// UC13 - Xem danh sách Learner (Organizer; tổ chức lấy từ danh tính người gọi)
export const getLearnersAPI = (query: IAccountListQuery) =>
  axios.get<IBackendRes<IPageResponse<ILearnerListItem>>>(
    "/api/v1/users/learners",
    { params: query },
  );

// UC13.2 - số chỗ Learner còn lại (Organizer)
export const getLearnerSeatsAPI = () =>
  axios.get<IBackendRes<ISeatUsage>>("/api/v1/users/learners/seats");

// UC13.2 - Thêm Learner (Organizer; backend gửi lời mời qua email)
export const createLearnerAPI = (body: ICreateAccountReq) =>
  axios.post<IBackendRes<IAccountListItem>>("/api/v1/users/learners", body);

// UC04 - Xem lời mời trước khi đặt mật khẩu
export const getInvitationAPI = (token: string) =>
  axios.get<IBackendRes<IInvitationInfo>>(
    `/api/v1/invitations/${encodeURIComponent(token)}`,
  );

// UC04 - Đặt mật khẩu và kích hoạt tài khoản
export const acceptInvitationAPI = (body: IAcceptInvitationReq) =>
  axios.post<IBackendRes<IAcceptInvitationResult>>("/api/v1/invitations/accept", body);
