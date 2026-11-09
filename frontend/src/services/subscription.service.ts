import { tenantAxios } from "@/services/axios.customize";
import type { IAdminPlan, ICreatePlanReq } from "@/types/organization.types";
import type {
  IRenewalQuote,
  IRenewalResult,
  ISubscriptionOverview,
  IUpgradeOptions,
  IUpgradeResult,
} from "@/types/subscription.types";

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

export const getRenewalQuoteAPI = () =>
  tenantAxios.get<IBackendRes<IRenewalQuote>>(
    "/api/v1/subscriptions/renewal-quote",
  );

export const renewSubscriptionAPI = (simulateFailure: boolean) =>
  tenantAxios.post<IBackendRes<IRenewalResult>>(
    "/api/v1/subscriptions/renewals",
    simulateFailure ? { simulateFailure } : {},
  );

export const getUpgradeOptionsAPI = () =>
  tenantAxios.get<IBackendRes<IUpgradeOptions>>(
    "/api/v1/subscriptions/upgrade-options",
  );

export const upgradeSubscriptionAPI = (
  planId: string,
  simulateFailure: boolean,
) =>
  tenantAxios.post<IBackendRes<IUpgradeResult>>(
    "/api/v1/subscriptions/upgrades",
    { planId, ...(simulateFailure ? { simulateFailure } : {}) },
  );
