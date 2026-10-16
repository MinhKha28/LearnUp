import { tenantAxios } from "@/services/axios.customize";
import type { ISubscriptionOverview } from "@/types/subscription.types";

export const getCurrentSubscriptionAPI = () =>
  tenantAxios.get<IBackendRes<ISubscriptionOverview>>(
    "/api/v1/subscriptions/current",
  );
