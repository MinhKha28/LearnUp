import { PassThrough } from "node:stream";
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  config: vi.fn(),
  upload: vi.fn(),
  chunked: vi.fn(),
  destroy: vi.fn(),
  url: vi.fn(),
  signed: vi.fn(),
}));
vi.mock("cloudinary", () => ({
  v2: {
    config: sdk.config,
    uploader: {
      upload_stream: sdk.upload,
      upload_chunked_stream: sdk.chunked,
      destroy: sdk.destroy,
    },
    url: sdk.url,
    utils: { private_download_url: sdk.signed },
  },
}));
import {
  CloudinaryStorageProvider,
  StorageProviderError,
  type StorageDeliveryType,
  type StoredResourceType,
} from "../src/index.js";

const file = {
  buffer: Buffer.from("fixture"),
  originalFilename: "fixture.png",
  mimeType: "image/png",
  sizeBytes: 7,
};
const future = () => Math.floor(Date.now() / 1000) + 60;
const signedOptions = () => ({
  resourceType: "image" as const,
  format: "png",
  deliveryType: "authenticated" as const,
  expiresAt: future(),
});
const readOptions = () => ({
  ...signedOptions(),
  timeoutMs: 1000,
  maxSizeBytes: 10,
});
let provider: CloudinaryStorageProvider;
let fetchMock: ReturnType<typeof vi.fn>;

const safeError = (code: string, message?: string) => ({
  asymmetricMatch(error: Error & { code?: string }) {
    expect(error).toBeInstanceOf(StorageProviderError);
    expect(error.cause).toBeUndefined();
    expect(inspect(error)).not.toContain("signature=secret");
    return (
      error.code === code &&
      (message === undefined || error.message === message)
    );
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  provider = new CloudinaryStorageProvider({
    cloudName: "fixture-cloud",
    apiKey: "fixture-key",
    apiSecret: "fixture-secret",
  });
  sdk.signed.mockReturnValue(
    "https://api.cloudinary.com/fixture/download?signature=synthetic",
  );
  sdk.url.mockReturnValue("https://res.cloudinary.com/fixture");
  sdk.destroy.mockResolvedValue({ result: "ok" });
  const upload = (
    _: unknown,
    callback: (error: unknown, result: unknown) => void,
  ) => {
    const stream = new PassThrough();
    stream.on("finish", () =>
      callback(null, {
        public_id: "folder/key",
        resource_type: "image",
        type: "upload",
        bytes: 7,
        url: "http://fixture",
        secure_url: "https://fixture",
      }),
    );
    return stream;
  };
  sdk.upload.mockImplementation(upload);
  sdk.chunked.mockImplementation(upload);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("legacy storage compatibility", () => {
  it.each(["image", "raw", "video"] as const)(
    "preserves default %s upload options and response",
    async (resourceType) => {
      const result = await provider.upload(file, {
        folder: "/folder//assets/",
        resourceType,
      });
      const call = resourceType === "video" ? sdk.chunked : sdk.upload;
      const options = call.mock.calls[0][0];
      expect(options).toMatchObject({
        folder: "folder/assets",
        resource_type: resourceType,
        overwrite: false,
      });
      expect(options).not.toHaveProperty("type");
      expect(options.public_id).toMatch(/^[0-9a-f-]{36}$/);
      if (resourceType === "video")
        expect(options.chunk_size).toBe(20 * 1024 * 1024);
      expect(result).toMatchObject({
        storageKey: "folder/key",
        mimeType: file.mimeType,
        sizeBytes: 7,
        secureUrl: "https://fixture",
      });
    },
  );
  it("preserves explicit key and overwrite opt-in; defaults resource type to auto", async () => {
    await provider.upload(file, {
      folder: "folder",
      publicId: "chosen",
      overwrite: true,
    });
    expect(sdk.upload.mock.calls[0][0]).toMatchObject({
      public_id: "chosen",
      overwrite: true,
      resource_type: "auto",
    });
  });
  it("keeps two-argument URL and default delete options unchanged", async () => {
    provider.getUrl("key", "image");
    expect(sdk.url).toHaveBeenCalledWith("key", {
      secure: true,
      resource_type: "image",
    });
    await provider.delete("key", { resourceType: "image" });
    expect(sdk.destroy).toHaveBeenCalledWith("key", {
      resource_type: "image",
      invalidate: true,
    });
  });
  it("uses a new key for each default upload", async () => {
    await provider.upload(file, { folder: "folder" });
    await provider.upload(file, { folder: "folder" });
    expect(sdk.upload.mock.calls[0][0].public_id).not.toBe(
      sdk.upload.mock.calls[1][0].public_id,
    );
  });
});

describe("protected delivery", () => {
  it.each(["upload", "private", "authenticated"] as const)(
    "forwards %s to upload, delete and URL",
    async (deliveryType) => {
      await provider.upload(file, {
        folder: "achievement/logos",
        deliveryType,
      });
      expect(sdk.upload.mock.calls[0][0]).toMatchObject({
        type: deliveryType,
        overwrite: false,
      });
      await provider.delete("key", {
        resourceType: "image",
        deliveryType,
        invalidate: false,
      });
      expect(sdk.destroy).toHaveBeenCalledWith("key", {
        resource_type: "image",
        type: deliveryType,
        invalidate: false,
      });
      if (deliveryType === "upload") {
        provider.getUrl("key", "image", { deliveryType });
        expect(sdk.url).toHaveBeenCalledWith("key", {
          resource_type: "image",
          secure: true,
          type: deliveryType,
        });
      } else {
        expect(() => provider.getUrl("key", "image", { deliveryType })).toThrow(
          "getSignedUrl",
        );
        expect(sdk.url).not.toHaveBeenCalled();
      }
    },
  );
  it("forwards authenticated delivery on chunked video uploads", async () => {
    await provider.upload(file, {
      folder: "folder",
      resourceType: "video",
      deliveryType: "authenticated",
    });
    expect(sdk.chunked.mock.calls[0][0]).toMatchObject({
      type: "authenticated",
      overwrite: false,
    });
  });
  it.each(["upload", "private", "authenticated"] as const)(
    "signs expiring %s downloads with instance credentials",
    (deliveryType) => {
      const options = { ...signedOptions(), deliveryType };
      provider.getSignedUrl("achievement/key", options);
      expect(sdk.signed).toHaveBeenCalledWith("achievement/key", "png", {
        cloud_name: "fixture-cloud",
        api_key: "fixture-key",
        api_secret: "fixture-secret",
        secure: true,
        resource_type: "image",
        type: deliveryType,
        expires_at: options.expiresAt,
      });
      expect(sdk.url).not.toHaveBeenCalled();
    },
  );
  it("defaults signed delivery to upload and retains raw extension in key", () => {
    provider.getSignedUrl("folder/file.pdf", {
      resourceType: "raw",
      format: "",
      expiresAt: future(),
    });
    expect(sdk.signed.mock.calls[0]).toEqual([
      "folder/file.pdf",
      "",
      expect.objectContaining({ resource_type: "raw", type: "upload" }),
    ]);
  });
  it("rejects unknown delivery types without calling the SDK", async () => {
    const deliveryType = "public" as StorageDeliveryType;
    await expect(
      provider.upload(file, { folder: "folder", deliveryType }),
    ).rejects.toThrow(StorageProviderError);
    await expect(
      provider.delete("key", { resourceType: "image", deliveryType }),
    ).rejects.toThrow(StorageProviderError);
    expect(() => provider.getUrl("key", "image", { deliveryType })).toThrow(
      StorageProviderError,
    );
    expect(sdk.upload).not.toHaveBeenCalled();
    expect(sdk.destroy).not.toHaveBeenCalled();
    expect(sdk.url).not.toHaveBeenCalled();
  });
  it.each([0, -1, NaN, Infinity, 1.5])(
    "rejects invalid expiry %s",
    (expiresAt) => {
      expect(() =>
        provider.getSignedUrl("key", { ...signedOptions(), expiresAt }),
      ).toThrow(StorageProviderError);
    },
  );
  it("rejects past expiry, empty key and invalid formats", () => {
    expect(() =>
      provider.getSignedUrl("key", {
        ...signedOptions(),
        expiresAt: Math.floor(Date.now() / 1000),
      }),
    ).toThrow(StorageProviderError);
    expect(() => provider.getSignedUrl(" ", signedOptions())).toThrow(
      StorageProviderError,
    );
    expect(() =>
      provider.getSignedUrl("key", { ...signedOptions(), format: "" }),
    ).toThrow(StorageProviderError);
    expect(() =>
      provider.getSignedUrl("key", {
        ...signedOptions(),
        resourceType: "raw",
        format: "../pdf",
      }),
    ).toThrow(StorageProviderError);
    expect(() =>
      provider.getSignedUrl("key", {
        ...signedOptions(),
        resourceType: "auto" as StoredResourceType,
      }),
    ).toThrow(StorageProviderError);
  });
  it("does not propagate SDK signing errors or their sensitive causes", () => {
    sdk.signed.mockImplementation(() => {
      throw new Error("sensitive fixture URL");
    });
    try {
      provider.getSignedUrl("key", signedOptions());
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(StorageProviderError);
      expect((error as Error).cause).toBeUndefined();
      expect(String(error)).not.toContain("sensitive");
    }
  });
});

describe("bounded server reads", () => {
  it.each([
    [404, "NOT_FOUND"],
    [401, "UNAVAILABLE"],
    [403, "UNAVAILABLE"],
    [500, "UNAVAILABLE"],
    [503, "UNAVAILABLE"],
    [504, "UNAVAILABLE"],
  ])(
    "classifies HTTP %s safely as %s, including an empty response body",
    async (status, code) => {
      fetchMock.mockResolvedValue(
        new Response(null, { status: status as number }),
      );
      await expect(provider.readBytes("key", readOptions())).rejects.toEqual(
        safeError(code as string),
      );
    },
  );

  it("classifies network errors without leaking their contents", async () => {
    fetchMock.mockRejectedValue(new Error("https://fixture?signature=secret"));
    await expect(provider.readBytes("key", readOptions())).rejects.toEqual(
      safeError("UNAVAILABLE"),
    );
  });
  it("reads bytes via an expiring URL without following redirects", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    expect(await provider.readBytes("key", readOptions())).toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("signature="),
      { signal: expect.any(AbortSignal), redirect: "error" },
    );
  });
  it("accepts a response exactly at the byte limit", async () => {
    fetchMock.mockResolvedValue(
      new Response("1234567890", { headers: { "content-length": "10" } }),
    );
    expect((await provider.readBytes("key", readOptions())).length).toBe(10);
  });
  it("rejects oversized Content-Length before consuming and cancels the body", async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(new ReadableStream({ cancel }), {
        headers: { "content-length": "11" },
      }),
    );
    await expect(
      provider.readBytes("key", readOptions()),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
    expect(cancel).toHaveBeenCalled();
  });
  it.each([undefined, "1"])(
    "enforces cumulative size despite Content-Length %s",
    (length) => {
      const cancel = vi.fn();
      fetchMock.mockResolvedValue(
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(new Uint8Array(5));
            },
            cancel,
          }),
          { headers: length ? { "content-length": length } : {} },
        ),
      );
      return expect(provider.readBytes("key", readOptions()))
        .rejects.toMatchObject({ code: "TOO_LARGE" })
        .then(() => expect(cancel).toHaveBeenCalled());
    },
  );
  it("aborts a request that stalls before headers", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () =>
            reject(new Error("synthetic signed URL")),
          ),
        ),
    );
    const promise = expect(
      provider.readBytes("key", { ...readOptions(), timeoutMs: 20 }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(20);
    await promise;
  });
  it("keeps the timeout active while the body stalls", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_: string, { signal }: { signal: AbortSignal }) =>
        Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                signal.addEventListener("abort", () =>
                  controller.error(new Error("timeout")),
                );
              },
            }),
          ),
        ),
    );
    const promise = expect(
      provider.readBytes("key", { ...readOptions(), timeoutMs: 20 }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(20);
    await promise;
  });
  it.each([401, 404, 500, 302])("rejects HTTP %s", async (status) => {
    fetchMock.mockResolvedValue(new Response("synthetic response", { status }));
    await expect(provider.readBytes("key", readOptions())).rejects.toThrow(
      StorageProviderError,
    );
  });
  it("sanitizes network errors and signed URLs", async () => {
    fetchMock.mockRejectedValue(new Error("https://fixture?signature=secret"));
    try {
      await provider.readBytes("key", readOptions());
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(StorageProviderError);
      expect((error as Error).cause).toBeUndefined();
      expect(String(error)).not.toContain("signature");
    }
  });
  it.each([0, -1, NaN, Infinity, 1.5])(
    "rejects invalid read limits %s before network access",
    async (limit) => {
      await expect(
        provider.readBytes("key", { ...readOptions(), timeoutMs: limit }),
      ).rejects.toThrow(StorageProviderError);
      await expect(
        provider.readBytes("key", { ...readOptions(), maxSizeBytes: limit }),
      ).rejects.toThrow(StorageProviderError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("safe provider contract", () => {
  it("sanitizes SDK public URL generation failures", () => {
    sdk.url.mockImplementation(() => {
      throw new Error("signature=secret");
    });
    expect(() => provider.getUrl("key", "image")).toThrow(
      "Cloudinary URL generation failed.",
    );
    try {
      provider.getUrl("key", "image");
    } catch (error) {
      expect(error).toEqual(safeError("UNAVAILABLE"));
    }
  });
  it("does not serialize or inspect signing credentials, even with hidden fields enabled", () => {
    for (const value of [
      JSON.stringify(provider),
      inspect(provider),
      inspect(provider, { showHidden: true }),
    ]) {
      expect(value).not.toContain("fixture-secret");
      expect(value).not.toContain("api_secret");
    }
  });

  it.each(["upload", "private", "authenticated"] as const)(
    "returns the SDK delivery type %s",
    async (deliveryType) => {
      sdk.upload.mockImplementation(
        (_: unknown, callback: (error: unknown, result: unknown) => void) => {
          const stream = new PassThrough();
          stream.on("finish", () =>
            callback(null, {
              public_id: "folder/key",
              resource_type: "image",
              type: deliveryType,
              url: "http://fixture",
              secure_url: "https://fixture",
            }),
          );
          return stream;
        },
      );
      expect(
        await provider.upload(file, { folder: "folder", deliveryType }),
      ).toMatchObject({ deliveryType });
    },
  );

  it("rejects an upload result with missing delivery metadata instead of guessing", async () => {
    sdk.upload.mockImplementation(
      (_: unknown, callback: (error: unknown, result: unknown) => void) => {
        const stream = new PassThrough();
        stream.on("finish", () =>
          callback(null, { public_id: "folder/key", resource_type: "image" }),
        );
        return stream;
      },
    );
    await expect(
      provider.upload(file, { folder: "folder" }),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("distinguishes authenticated deletion, wrong default type, and repeated cleanup", async () => {
    let exists = true;
    sdk.destroy.mockImplementation(
      async (_: string, options: { type?: string }) => {
        if (options.type !== "authenticated" || !exists)
          return { result: "not found" };
        exists = false;
        return { result: "ok" };
      },
    );
    expect(await provider.delete("key", { resourceType: "image" })).toEqual({
      status: "not_found",
    });
    expect(exists).toBe(true);
    expect(
      await provider.delete("key", {
        resourceType: "image",
        deliveryType: "authenticated",
      }),
    ).toEqual({ status: "deleted" });
    expect(
      await provider.delete("key", {
        resourceType: "image",
        deliveryType: "authenticated",
      }),
    ).toEqual({ status: "not_found" });
  });

  it("does not expose unexpected delete results", async () => {
    sdk.destroy.mockResolvedValue({
      result: "https://fixture?signature=secret",
    });
    await expect(
      provider.delete("key", { resourceType: "image" }),
    ).rejects.toEqual(safeError("UNAVAILABLE", "Cloudinary delete failed."));
  });

  it.each([
    [{ http_code: 404 }, "NOT_FOUND"],
    [{ code: "ETIMEDOUT" }, "TIMEOUT"],
    [{ http_code: 413 }, "TOO_LARGE"],
    [{ http_code: 401 }, "UNAVAILABLE"],
    [{ http_code: 403 }, "UNAVAILABLE"],
    [{ http_code: 500 }, "UNAVAILABLE"],
    [{ http_code: 504 }, "UNAVAILABLE"],
    [{}, "UNAVAILABLE"],
  ])("sanitizes SDK upload/delete failures %j as %s", async (details, code) => {
    const error = Object.assign(
      new Error("https://fixture?signature=secret"),
      details,
    );
    sdk.destroy.mockRejectedValue(error);
    sdk.upload.mockImplementation(
      (_: unknown, callback: (error: unknown) => void) => {
        const stream = new PassThrough();
        stream.on("finish", () => callback(error));
        return stream;
      },
    );
    for (const operation of [
      () => provider.upload(file, { folder: "folder" }),
      () => provider.delete("key", { resourceType: "image" }),
    ]) {
      await expect(operation()).rejects.toEqual(safeError(code as string));
      await expect(operation()).rejects.not.toThrow("signature");
    }
  });

  it("sanitizes synchronous SDK and upload stream failures", async () => {
    sdk.upload.mockImplementation(() => {
      throw Object.assign(new Error("signature=secret"), { code: "ETIMEDOUT" });
    });
    await expect(provider.upload(file, { folder: "folder" })).rejects.toEqual(
      safeError("TIMEOUT"),
    );
    sdk.upload.mockImplementation(() => {
      const stream = new PassThrough();
      stream.on("finish", () =>
        stream.emit("error", new Error("signature=secret")),
      );
      return stream;
    });
    await expect(provider.upload(file, { folder: "folder" })).rejects.toEqual(
      safeError("UNAVAILABLE", "Cloudinary upload stream failed."),
    );
  });
});

describe("plan upload enforcement", () => {
  it.each(["raw", "image", "video"] as const)(
    "honours custom %s boundary using Buffer length",
    async (resourceType) => {
      provider = new CloudinaryStorageProvider({
        cloudName: "fixture",
        apiKey: "fixture",
        apiSecret: "fixture",
        planLimits: { rawMaxBytes: 7, imageMaxBytes: 7, videoMaxBytes: 7 },
      });
      await expect(
        provider.upload(
          { ...file, buffer: Buffer.alloc(8), sizeBytes: 1 },
          { folder: "folder", resourceType },
        ),
      ).rejects.toMatchObject({ code: "TOO_LARGE" });
      expect(sdk.upload).not.toHaveBeenCalled();
      expect(sdk.chunked).not.toHaveBeenCalled();
      await expect(
        provider.upload(file, { folder: "folder", resourceType }),
      ).resolves.toHaveProperty("storageKey");
    },
  );
  it.each([
    ["File size too large. Got 11534336. Maximum is 10485760.", "TOO_LARGE"],
    ["Invalid parameter", "UNAVAILABLE"],
  ])("classifies 400 %s safely", async (message, code) => {
    sdk.destroy.mockRejectedValue({ http_code: 400, message, name: "Error" });
    await expect(
      provider.delete("key", { resourceType: "raw" }),
    ).rejects.toEqual(safeError(code, "Cloudinary delete failed."));
  });
});
