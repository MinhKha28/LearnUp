import { StorageError } from "./errors/storage.error.js";
import type { StorageResourceType } from "./storage.types.js";

export interface IStoragePlanLimits {
  rawMaxBytes: number;
  imageMaxBytes: number;
  videoMaxBytes: number;
}
export const DEFAULT_STORAGE_MAX_RAW_BYTES = 10485760;
export const DEFAULT_STORAGE_MAX_IMAGE_BYTES = 10485760;
export const DEFAULT_STORAGE_MAX_VIDEO_BYTES = 104857600;

function positiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StorageError(
      `Invalid ${name}: expected a positive safe integer.`,
    );
  }
  return value;
}
export function validateStoragePlanLimits(
  limits: IStoragePlanLimits,
): IStoragePlanLimits {
  return {
    rawMaxBytes: positiveSafeInteger(
      limits.rawMaxBytes,
      "STORAGE_MAX_RAW_BYTES",
    ),
    imageMaxBytes: positiveSafeInteger(
      limits.imageMaxBytes,
      "STORAGE_MAX_IMAGE_BYTES",
    ),
    videoMaxBytes: positiveSafeInteger(
      limits.videoMaxBytes,
      "STORAGE_MAX_VIDEO_BYTES",
    ),
  };
}
export function resolveStoragePlanLimits(
  env: Record<string, string | undefined>,
): IStoragePlanLimits {
  const read = (name: string, fallback: number): number => {
    const value = env[name];
    if (value === undefined || value === "") return fallback;
    if (!/^[0-9]+$/.test(value))
      throw new StorageError(
        `Invalid ${name}: expected a positive safe integer.`,
      );
    return positiveSafeInteger(Number(value), name);
  };
  return {
    rawMaxBytes: read("STORAGE_MAX_RAW_BYTES", DEFAULT_STORAGE_MAX_RAW_BYTES),
    imageMaxBytes: read(
      "STORAGE_MAX_IMAGE_BYTES",
      DEFAULT_STORAGE_MAX_IMAGE_BYTES,
    ),
    videoMaxBytes: read(
      "STORAGE_MAX_VIDEO_BYTES",
      DEFAULT_STORAGE_MAX_VIDEO_BYTES,
    ),
  };
}
export function maxUploadBytesFor(
  limits: IStoragePlanLimits,
  resourceType: StorageResourceType,
): number | undefined {
  switch (resourceType) {
    case "raw":
      return limits.rawMaxBytes;
    case "image":
      return limits.imageMaxBytes;
    case "video":
      return limits.videoMaxBytes;
    case "auto":
      return undefined;
  }
}

/** The largest upload a consumer accepts: its own product ceiling, lowered to the storage plan limit of the resource type. */
export function effectiveUploadLimit(
  ceilingBytes: number,
  limits: IStoragePlanLimits,
  resourceType: StorageResourceType,
): number {
  const planBytes = maxUploadBytesFor(limits, resourceType);
  return planBytes === undefined
    ? ceilingBytes
    : Math.min(ceilingBytes, planBytes);
}
