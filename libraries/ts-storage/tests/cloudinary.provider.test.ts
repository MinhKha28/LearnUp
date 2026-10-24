import { PassThrough } from "node:stream";
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
      provider.getUrl("key", "image", { deliveryType });
      expect(sdk.url).toHaveBeenCalledWith("key", {
        resource_type: "image",
        secure: true,
        type: deliveryType,
      });
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
    await expect(provider.readBytes("key", readOptions())).rejects.toThrow(
      StorageProviderError,
    );
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
        .rejects.toThrow(StorageProviderError)
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
    ).rejects.toThrow(StorageProviderError);
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
    ).rejects.toThrow(StorageProviderError);
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
