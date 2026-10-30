import { tenantAxios } from "@/services/axios.customize";
import type {
  IRenewalQuote,
  IRenewalResult,
  ISubscriptionOverview,
  IUpgradeOptions,
  IUpgradeResult,
} from "@/types/subscription.types";

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

export const getRenewalQuoteAPI = () =>
  tenantAxios.get<IBackendRes<IRenewalQuote>>(
    "/api/v1/subscriptions/renewal-quote",
  );

export const renewSubscriptionAPI = (simulateFailure: boolean) =>
  tenantAxios.post<IBackendRes<IRenewalResult>>(
    "/api/v1/subscriptions/renewals",
    simulateFailure ? { simulateFailure } : {},
  );

export const getCurrentSubscriptionAPI = () =>
  tenantAxios.get<IBackendRes<ISubscriptionOverview>>(
    "/api/v1/subscriptions/current",
  );
