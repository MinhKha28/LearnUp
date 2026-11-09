import {
  maxUploadBytesFor,
  type IStoragePlanLimits,
} from "../../storage-plan-limits.js";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import type {
  IStorageDeleteOptions,
  IStorageDeleteResult,
  IStorageFileInput,
  IReadableStorageProvider,
  IStorageUrlOptions,
  IStorageSignedUrlOptions,
  IStorageReadOptions,
  IStorageUploadOptions,
  IStoredFile,
} from "../../interfaces/storage.interface.js";

import type {
  StoredResourceType,
  StorageDeliveryType,
} from "../../storage.types.js";

import { StorageProviderError } from "../../errors/storage.error.js";
import { validateStorageFile } from "../../validators/file.validator.js";
import { validateCloudinaryConfig } from "./cloudinary.config.js";
import type { ICloudinaryStorageConfig } from "./cloudinary.interface.js";

export class CloudinaryStorageProvider implements IReadableStorageProvider {
  readonly #planLimits: IStoragePlanLimits;
  readonly #signingConfig: {
    cloud_name: string;
    api_key: string;
    api_secret: string;
    secure: boolean;
  };
  constructor(config: ICloudinaryStorageConfig) {
    const validatedConfig = validateCloudinaryConfig(config);
    this.#planLimits = validatedConfig.planLimits!;
    this.#signingConfig = {
      cloud_name: validatedConfig.cloudName,
      api_key: validatedConfig.apiKey,
      api_secret: validatedConfig.apiSecret,
      secure: true,
    };

    cloudinary.config({
      cloud_name: validatedConfig.cloudName,
      api_key: validatedConfig.apiKey,
      api_secret: validatedConfig.apiSecret,
      secure: validatedConfig.secure,
    });
  }

  async upload(
    file: IStorageFileInput,
    options: IStorageUploadOptions,
  ): Promise<IStoredFile> {
    validateStorageFile(file, options.validation);

    const resourceType = options.resourceType ?? "auto";
    const maxBytes = maxUploadBytesFor(this.#planLimits, resourceType);
    if (maxBytes !== undefined && file.buffer.length > maxBytes) {
      throw new StorageProviderError(
        "File exceeds storage plan upload limit.",
        "TOO_LARGE",
      );
    }

    const folder = this.normalizeFolder(options.folder);
    const publicId = options.publicId?.trim() || randomUUID();
    this.validateDeliveryType(options.deliveryType);

    try {
      const result = await this.uploadBuffer(file, {
        folder,
        publicId,
        resourceType,
        overwrite: options.overwrite ?? false,
        tags: options.tags,
        deliveryType: options.deliveryType,
      });

      return this.mapUploadResult(result, file);
    } catch (error) {
      if (error instanceof StorageProviderError) {
        throw error;
      }

      throw this.providerFailure("Cloudinary upload failed.", error);
    }
  }

  async delete(
    storageKey: string,
    options: IStorageDeleteOptions,
  ): Promise<IStorageDeleteResult> {
    this.validateDeliveryType(options.deliveryType);
    if (!storageKey?.trim()) {
      throw new StorageProviderError("Storage key is required.");
    }

    try {
      const result = await cloudinary.uploader.destroy(storageKey, {
        resource_type: options.resourceType,
        invalidate: options.invalidate ?? true,
        ...(options.deliveryType === undefined
          ? {}
          : { type: options.deliveryType }),
      });

      if (result.result === "ok") return { status: "deleted" };
      if (result.result === "not found") return { status: "not_found" };
      throw new StorageProviderError("Cloudinary delete failed.");
    } catch (error) {
      if (error instanceof StorageProviderError) {
        throw error;
      }

      throw this.providerFailure("Cloudinary delete failed.", error);
    }
  }

  getUrl(storageKey: string, resourceType: StoredResourceType): string;
  getUrl(
    storageKey: string,
    resourceType: StoredResourceType,
    options: IStorageUrlOptions,
  ): string;
  getUrl(
    storageKey: string,
    resourceType: StoredResourceType,
    options?: IStorageUrlOptions,
  ): string {
    if (!storageKey?.trim()) {
      throw new StorageProviderError("Storage key is required.");
    }

    this.validateDeliveryType(options?.deliveryType);
    if (
      options?.deliveryType !== undefined &&
      options.deliveryType !== "upload"
    ) {
      throw new StorageProviderError(
        "Protected delivery requires getSignedUrl().",
      );
    }
    try {
      return cloudinary.url(storageKey, {
        secure: true,
        resource_type: resourceType,
        ...(options?.deliveryType === undefined
          ? {}
          : { type: options.deliveryType }),
      });
    } catch {
      throw new StorageProviderError("Cloudinary URL generation failed.");
    }
  }

  /** Time-limited Upload API download URL, not a permanent signed CDN URL. */
  getSignedUrl(storageKey: string, options: IStorageSignedUrlOptions): string {
    if (!storageKey?.trim())
      throw new StorageProviderError("Storage key is required.");
    this.validateDeliveryType(options.deliveryType);
    if (
      !Number.isSafeInteger(options.expiresAt) ||
      options.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      throw new StorageProviderError(
        "Expiration must be a future UNIX timestamp in seconds.",
      );
    }
    if (
      !["image", "video", "raw"].includes(options.resourceType) ||
      typeof options.format !== "string" ||
      (!(options.resourceType === "raw" && options.format === "") &&
        !/^[a-zA-Z0-9]+$/.test(options.format))
    ) {
      throw new StorageProviderError(
        "Invalid download resource type or format.",
      );
    }
    try {
      const sdkOptions = {
        ...this.#signingConfig,
        resource_type: options.resourceType,
        type: options.deliveryType ?? "upload",
        expires_at: options.expiresAt,
      };
      return cloudinary.utils.private_download_url(
        storageKey,
        options.format,
        sdkOptions,
      );
    } catch {
      throw new StorageProviderError("Cloudinary URL signing failed.");
    }
  }

  async readBytes(
    storageKey: string,
    options: IStorageReadOptions,
  ): Promise<Buffer> {
    if (
      !Number.isSafeInteger(options.timeoutMs) ||
      options.timeoutMs <= 0 ||
      options.timeoutMs > 2_147_483_647 ||
      !Number.isSafeInteger(options.maxSizeBytes) ||
      options.maxSizeBytes <= 0
    ) {
      throw new StorageProviderError(
        "Read timeout and size limit must be positive integers.",
      );
    }
    const url = this.getSignedUrl(storageKey, options);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "error",
      });
      if (response.body) reader = response.body.getReader();
      if (!response.ok) {
        throw new StorageProviderError(
          "Cloudinary read failed.",
          response.status === 404 ? "NOT_FOUND" : "UNAVAILABLE",
        );
      }
      if (!reader) throw new StorageProviderError("Cloudinary read failed.");
      const length = response.headers.get("content-length");
      if (length !== null && Number(length) > options.maxSizeBytes)
        throw new StorageProviderError(
          "Cloudinary read exceeds size limit.",
          "TOO_LARGE",
        );
      const chunks: Buffer[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > options.maxSizeBytes)
          throw new StorageProviderError(
            "Cloudinary read exceeds size limit.",
            "TOO_LARGE",
          );
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks, size);
    } catch (error) {
      // SDK/fetch errors can contain signed URLs; never attach them as a cause.
      if (error instanceof StorageProviderError) throw error;
      throw new StorageProviderError(
        "Cloudinary read failed.",
        controller.signal.aborted ? "TIMEOUT" : "UNAVAILABLE",
      );
    } finally {
      clearTimeout(timer);
      controller.abort();
      if (reader) {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }
  }

  private providerFailure(
    message: string,
    error: unknown,
  ): StorageProviderError {
    // Inspect the message prefix only to classify the provider size error; never expose it.
    const details =
      typeof error === "object" && error !== null
        ? (error as {
            http_code?: unknown;
            code?: unknown;
            name?: unknown;
            message?: unknown;
          })
        : undefined;
    const code =
      details?.http_code === 404
        ? "NOT_FOUND"
        : details?.http_code === 408 ||
            details?.code === "ETIMEDOUT" ||
            details?.code === "ESOCKETTIMEDOUT" ||
            details?.name === "TimeoutError"
          ? "TIMEOUT"
          : details?.http_code === 413 ||
              (details?.http_code === 400 &&
                typeof details.message === "string" &&
                details.message.startsWith("File size too large"))
            ? "TOO_LARGE"
            : "UNAVAILABLE";
    return new StorageProviderError(message, code);
  }

  private validateDeliveryType(type: StorageDeliveryType | undefined): void {
    if (
      type !== undefined &&
      !["upload", "private", "authenticated"].includes(type)
    ) {
      throw new StorageProviderError("Invalid storage delivery type.");
    }
  }

  private uploadBuffer(
    file: IStorageFileInput,
    options: {
      folder: string;
      publicId: string;
      resourceType: IStorageUploadOptions["resourceType"];
      overwrite: boolean;
      tags?: string[];
      deliveryType?: StorageDeliveryType;
    },
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.resourceType ?? "auto",
        overwrite: options.overwrite,
        tags: options.tags,
        ...(options.deliveryType === undefined
          ? {}
          : { type: options.deliveryType }),
      };

      const onResult = (
        error: unknown,
        result: UploadApiResponse | undefined,
      ) => {
        if (error) {
          reject(this.providerFailure("Cloudinary upload failed.", error));
          return;
        }

        // Chunked upload có thể trả kết quả trung gian.
        // Chỉ kết thúc Promise sau chunk cuối cùng.
        if (
          (
            result as
              | (UploadApiResponse & {
                  done?: boolean;
                })
              | undefined
          )?.done === false
        ) {
          return;
        }

        if (!result?.public_id) {
          reject(
            new StorageProviderError(
              "Cloudinary did not return a completed upload.",
            ),
          );
          return;
        }

        resolve(result);
      };

      // Video: chunk upload để hỗ trợ file >100 MB.
      // Các file khác vẫn giữ đường upload hiện tại.
      const stream =
        options.resourceType === "video"
          ? cloudinary.uploader.upload_chunked_stream(
              {
                ...uploadOptions,
                resource_type: "video",
                chunk_size: 20 * 1024 * 1024,
              },
              onResult,
            )
          : cloudinary.uploader.upload_stream(uploadOptions, onResult);

      stream.on("error", (error) => {
        reject(this.providerFailure("Cloudinary upload stream failed.", error));
      });

      // Giữ Buffer: không thay đổi Interface thư viện.
      stream.end(file.buffer);
    });
  }

  private mapUploadResult(
    result: UploadApiResponse,
    file: IStorageFileInput,
  ): IStoredFile {
    const resourceType = result.resource_type;

    if (
      resourceType !== "image" &&
      resourceType !== "video" &&
      resourceType !== "raw"
    ) {
      throw new StorageProviderError("Unsupported Cloudinary resource type.");
    }

    if (!["upload", "private", "authenticated"].includes(result.type)) {
      throw new StorageProviderError(
        "Cloudinary returned an invalid delivery type.",
      );
    }

    return {
      deliveryType: result.type as StorageDeliveryType,
      storageKey: result.public_id,
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      resourceType,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: result.bytes ?? file.sizeBytes,
      format: result.format,
      width: result.width,
      height: result.height,
      durationSeconds:
        typeof result.duration === "number"
          ? Math.ceil(result.duration)
          : undefined,
    };
  }

  private normalizeFolder(folder: string): string {
    const normalized = folder
      .trim()
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/{2,}/g, "/");

    if (!normalized) {
      throw new StorageProviderError("Storage folder is required.");
    }

    if (normalized.split("/").some((part) => part === "." || part === "..")) {
      throw new StorageProviderError(
        "Storage folder contains invalid path segments.",
      );
    }

    return normalized;
  }
}
