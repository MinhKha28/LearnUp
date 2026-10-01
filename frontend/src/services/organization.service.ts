import type {
  IAccountListItem,
  IAccountListQuery,
  ICreateAccountReq,
  ICreateRegistrationReq,
  ICreateRegistrationRes,
  IInstructorListItem,
  ISeatUsage,
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
