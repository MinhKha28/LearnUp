import { describe, it, expect } from "vitest";
import {
  resolveStoragePlanLimits,
  maxUploadBytesFor,
  StorageError,
  validateCloudinaryConfig,
} from "../src/index.js";
const defaults = {
  rawMaxBytes: 10485760,
  imageMaxBytes: 10485760,
  videoMaxBytes: 104857600,
};
describe("storage plan limits", () => {
  it("defaults absent and empty values", () => {
    expect(resolveStoragePlanLimits({})).toEqual(defaults);
    expect(
      resolveStoragePlanLimits({
        STORAGE_MAX_RAW_BYTES: "",
        STORAGE_MAX_IMAGE_BYTES: "",
        STORAGE_MAX_VIDEO_BYTES: "",
      }),
    ).toEqual(defaults);
  });
  it("accepts overrides", () => {
    expect(
      resolveStoragePlanLimits({
        STORAGE_MAX_RAW_BYTES: "12",
        STORAGE_MAX_IMAGE_BYTES: "13",
        STORAGE_MAX_VIDEO_BYTES: "14",
      }),
    ).toEqual({ rawMaxBytes: 12, imageMaxBytes: 13, videoMaxBytes: 14 });
  });
  for (const key of [
    "STORAGE_MAX_RAW_BYTES",
    "STORAGE_MAX_IMAGE_BYTES",
    "STORAGE_MAX_VIDEO_BYTES",
  ]) {
    it.each(["0", "-1", "1.5", "abc", "9007199254740992", "12garbage", " "])(
      `${key} rejects %j safely`,
      (value) => {
        expect(() => resolveStoragePlanLimits({ [key]: value })).toThrow(
          StorageError,
        );
        expect(() => resolveStoragePlanLimits({ [key]: value })).toThrow(key);
      },
    );
  }
  it.each([
    ["raw", 10485760],
    ["image", 10485760],
    ["video", 104857600],
    ["auto", undefined],
  ] as const)("maps %s", (type, size) =>
    expect(maxUploadBytesFor(defaults, type)).toBe(size),
  );
  it("validates direct config limits", () => {
    expect(() =>
      validateCloudinaryConfig({
        cloudName: "fixture",
        apiKey: "fixture",
        apiSecret: "fixture",
        planLimits: { ...defaults, rawMaxBytes: 0 },
      }),
    ).toThrow(StorageError);
  });
});
