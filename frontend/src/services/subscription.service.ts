import { tenantAxios } from "@/services/axios.customize";
import type {
  IRenewalQuote,
  IRenewalResult,
  ISubscriptionOverview,
} from "@/types/subscription.types";

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
