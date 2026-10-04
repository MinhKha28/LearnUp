import { randomUUID } from "node:crypto";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import type {
  IStorageDeleteOptions,
  IStorageFileInput,
  IStorageProvider,
  IStorageUploadOptions,
  IStoredFile,
} from "../../interfaces/storage.interface.js";

import type { StoredResourceType } from "../../storage.types.js";

import { StorageProviderError } from "../../errors/storage.error.js";
import { validateStorageFile } from "../../validators/file.validator.js";
import { validateCloudinaryConfig } from "./cloudinary.config.js";
import type { ICloudinaryStorageConfig } from "./cloudinary.interface.js";

export class CloudinaryStorageProvider implements IStorageProvider {
  constructor(config: ICloudinaryStorageConfig) {
    const validatedConfig = validateCloudinaryConfig(config);

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

    const folder = this.normalizeFolder(options.folder);
    const publicId = options.publicId?.trim() || randomUUID();

    try {
      const result = await this.uploadBuffer(file, {
        folder,
        publicId,
        resourceType: options.resourceType ?? "auto",
        overwrite: options.overwrite ?? false,
        tags: options.tags,
      });

      return this.mapUploadResult(result, file);
    } catch (error) {
      if (error instanceof StorageProviderError) {
        throw error;
      }

      throw new StorageProviderError("Cloudinary upload failed.", {
        cause: error,
      });
    }
  }

  async delete(
    storageKey: string,
    options: IStorageDeleteOptions,
  ): Promise<void> {
    if (!storageKey?.trim()) {
      throw new StorageProviderError("Storage key is required.");
    }

    try {
      const result = await cloudinary.uploader.destroy(storageKey, {
        resource_type: options.resourceType,
        invalidate: options.invalidate ?? true,
      });

      if (result.result !== "ok" && result.result !== "not found") {
        throw new StorageProviderError(
          `Cloudinary delete failed with result: ${result.result}.`,
        );
      }
    } catch (error) {
      if (error instanceof StorageProviderError) {
        throw error;
      }

      throw new StorageProviderError("Cloudinary delete failed.", {
        cause: error,
      });
    }
  }

  getUrl(storageKey: string, resourceType: StoredResourceType): string {
    if (!storageKey?.trim()) {
      throw new StorageProviderError("Storage key is required.");
    }

    return cloudinary.url(storageKey, {
      secure: true,
      resource_type: resourceType,
    });
  }

  private uploadBuffer(
    file: IStorageFileInput,
    options: {
      folder: string;
      publicId: string;
      resourceType: IStorageUploadOptions["resourceType"];
      overwrite: boolean;
      tags?: string[];
    },
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder,
          public_id: options.publicId,
          resource_type: options.resourceType ?? "auto",
          overwrite: options.overwrite,
          tags: options.tags,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new StorageProviderError("Cloudinary upload stream failed.", {
                cause: error ?? undefined,
              }),
            );
            return;
          }

          resolve(result);
        },
      );

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
      throw new StorageProviderError(
        `Unsupported Cloudinary resource type: ${resourceType}.`,
      );
    }

    return {
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
