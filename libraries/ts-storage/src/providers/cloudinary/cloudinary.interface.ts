import type { IStoragePlanLimits } from "../../storage-plan-limits.js";
export interface ICloudinaryStorageConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  secure?: boolean;
  planLimits?: IStoragePlanLimits;
}
