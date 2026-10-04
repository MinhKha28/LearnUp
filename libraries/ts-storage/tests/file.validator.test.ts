import { describe, expect, it } from "vitest";

import { StorageValidationError, validateStorageFile } from "../src/index.js";

describe("validateStorageFile", () => {
  it("accepts valid file", () => {
    expect(() =>
      validateStorageFile(
        {
          buffer: Buffer.from("test"),
          originalFilename: "document.pdf",
          mimeType: "application/pdf",
          sizeBytes: 4,
        },
        {
          maxSizeBytes: 1024,
          allowedMimeTypes: ["application/pdf"],
        },
      ),
    ).not.toThrow();
  });

  it("rejects oversized file", () => {
    expect(() =>
      validateStorageFile(
        {
          buffer: Buffer.from("test"),
          originalFilename: "video.mp4",
          mimeType: "video/mp4",
          sizeBytes: 200,
        },
        {
          maxSizeBytes: 100,
        },
      ),
    ).toThrow(StorageValidationError);
  });

  it("rejects unsupported mime type", () => {
    expect(() =>
      validateStorageFile(
        {
          buffer: Buffer.from("test"),
          originalFilename: "payload.exe",
          mimeType: "application/octet-stream",
          sizeBytes: 4,
        },
        {
          allowedMimeTypes: ["application/pdf"],
        },
      ),
    ).toThrow(StorageValidationError);
  });
});
