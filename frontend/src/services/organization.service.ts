import type {
  IAccountListQuery,
  ICreateRegistrationReq,
  ICreateRegistrationRes,
  IInstructorListItem,
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
