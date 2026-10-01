import type {
  IAccountListQuery,
  IInstructorListItem,
  ISubscriptionPlan,
} from "@/types/organization.types";
import axios from "@/services/axios.customize";

// UC01 - Xem Subscription Plan (Guest, không cần đăng nhập)
export const getSubscriptionPlansAPI = () =>
  axios.get<IBackendRes<ISubscriptionPlan[]>>("/api/v1/subscription-plans");

// UC12 - Xem danh sách Instructor (Organizer; tổ chức lấy từ danh tính người gọi)
export const getInstructorsAPI = (query: IAccountListQuery) =>
  axios.get<IBackendRes<IPageResponse<IInstructorListItem>>>(
    "/api/v1/users/instructors",
    { params: query },
  );
