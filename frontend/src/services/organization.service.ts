import type {
  IAccountListQuery,
  ICreateRegistrationReq,
  ICreateRegistrationRes,
  IInstructorListItem,
  IPaymentResult,
  IPayRegistrationReq,
  IRegistrationSummary,
  ISubscriptionPlan,
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

// UC12 - Xem danh sách Instructor (Organizer; tổ chức lấy từ danh tính người gọi)
export const getInstructorsAPI = (query: IAccountListQuery) =>
  axios.get<IBackendRes<IPageResponse<IInstructorListItem>>>(
    "/api/v1/users/instructors",
    { params: query },
  );
