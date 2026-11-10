import {
  resolveStoragePlanLimits,
  validateStoragePlanLimits,
} from "../../storage-plan-limits.js";
import type { ICloudinaryStorageConfig } from "./cloudinary.interface.js";
import { StorageValidationError } from "../../errors/storage.error.js";

export function validateCloudinaryConfig(
  config: ICloudinaryStorageConfig,
): ICloudinaryStorageConfig {
  if (!config.cloudName?.trim()) {
    throw new StorageValidationError("Cloudinary cloudName is required.");
  }

  if (!config.apiKey?.trim()) {
    throw new StorageValidationError("Cloudinary apiKey is required.");
  }

  if (!config.apiSecret?.trim()) {
    throw new StorageValidationError("Cloudinary apiSecret is required.");
  }

  return {
    cloudName: config.cloudName.trim(),
    apiKey: config.apiKey.trim(),
    apiSecret: config.apiSecret.trim(),
    secure: config.secure ?? true,
    planLimits:
      config.planLimits === undefined
        ? resolveStoragePlanLimits({})
        : validateStoragePlanLimits(config.planLimits),
  };
}
