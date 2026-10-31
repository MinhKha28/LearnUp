import { tenantAxios } from "@/services/axios.customize";
import type { IAdminPlan, ICreatePlanReq } from "@/types/organization.types";
import type { ISubscriptionOverview } from "@/types/subscription.types";

export const getAdminPlansAPI = () =>
  tenantAxios.get<IBackendRes<IAdminPlan[]>>(
    "/api/v1/admin/subscription-plans",
  );

export const createPlanAPI = (body: ICreatePlanReq) =>
  tenantAxios.post<IBackendRes<IAdminPlan>>(
    "/api/v1/admin/subscription-plans",
    body,
  );

export const getCurrentSubscriptionAPI = () =>
  tenantAxios.get<IBackendRes<ISubscriptionOverview>>(
    "/api/v1/subscriptions/current",
  );
