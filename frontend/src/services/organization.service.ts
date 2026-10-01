import type { ISubscriptionPlan } from "@/types/organization.types";
import axios from "@/services/axios.customize";

// UC01 - Xem Subscription Plan (Guest, không cần đăng nhập)
export const getSubscriptionPlansAPI = () =>
  axios.get<IBackendRes<ISubscriptionPlan[]>>("/api/v1/subscription-plans");
