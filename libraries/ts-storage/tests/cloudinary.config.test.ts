import { describe, expect, it } from "vitest";

import {
  StorageValidationError,
  validateCloudinaryConfig,
} from "../src/index.js";

describe("validateCloudinaryConfig", () => {
  it("returns normalized config", () => {
    const result = validateCloudinaryConfig({
      cloudName: " demo-cloud ",
      apiKey: " key ",
      apiSecret: " secret ",
    });

    expect(result).toEqual({
      cloudName: "demo-cloud",
      apiKey: "key",
      apiSecret: "secret",
      secure: true,
    });
  });

  it("rejects missing credentials", () => {
    expect(() =>
      validateCloudinaryConfig({
        cloudName: "",
        apiKey: "",
        apiSecret: "",
      }),
    ).toThrow(StorageValidationError);
  });
});
